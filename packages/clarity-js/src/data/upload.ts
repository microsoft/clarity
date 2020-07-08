import { EncodedPayload, Event, Metric, Token, Transit, UploadData } from "@clarity-types/data";
import config from "@src/core/config";
import measure from "@src/core/measure";
import { time } from "@src/core/time";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import encode from "@src/data/encode";
import * as metadata from "@src/data/metadata";
import * as metric from "@src/data/metric";
import * as ping from "@src/data/ping";
import * as target from "@src/data/target";
import * as performance from "@src/performance/";

const MAX_RETRIES = 2;
const MAX_BACKUP_BYTES = 10 * 1024 * 1024; // 10MB
let backupBytes: number = 0;
let backup: string[];
let events: string[];
let timeout: number = null;
let transit: Transit;
let active: boolean;
let queuedTime: number = 0;
export let track: UploadData;

export function start(): void {
    active = true;
    backupBytes = 0;
    queuedTime = 0;
    backup = [];
    events = [];
    transit = {};
    track = null;
}

export function queue(data: Token[]): void {
    if (active) {
        let now = time();
        let type = data.length > 1 ? data[1] : null;
        let event = JSON.stringify(data);
        let container = events;
        // When transmit is set to true (default), it indicates that we should schedule an upload
        // However, in certain scenarios - like metric calculation - that are triggered as part of an existing upload
        // We do not want to trigger yet another upload, instead enrich the existing outgoing upload.
        // In these cases, we explicitly set transmit to false.
        let transmit = true;

        switch (type) {
            case Event.Target:
                metric.count(Metric.TargetBytes, event.length);
                transmit = false;
                break;
            case Event.Memory:
            case Event.Network:
            case Event.Connection:
            case Event.ContentfulPaint:
            case Event.LongTask:
            case Event.Navigation:
            case Event.Paint:
                metric.count(Metric.PerformanceBytes, event.length);
                transmit = false;
                break;
            case Event.Metric:
            case Event.Upload:
            case Event.InternalError:
                transmit = false;
                break;
            case Event.Discover:
            case Event.Mutation:
                // Layout events are queued based on the current configuration
                // If lean mode is on, instead of sending these events to server, we back them up in memory.
                // Later, if an upgrade call is called later in the session, we retrieve in memory backup and send them to server.
                // At the moment, we limit backup to grow until MAX_BACKUP_BYTES. Anytime we grow past this size, we start dropping events.
                // This is not ideal, and more of a fail safe mechanism.
                if (config.lean) {
                    transmit = false;
                    backupBytes += event.length;
                    container = backupBytes < MAX_BACKUP_BYTES ? backup : null;
                } else { metric.count(Metric.LayoutBytes, event.length); }
                break;
            case Event.BoxModel:
                metric.count(Metric.RegionBytes, event.length);
                break;
            case Event.Document:
            case Event.ScriptError:
            case Event.ImageError:
                // By default, all events are automatically rolled up under Metric.TotalBytes
                break;
            case Event.Upgrade:
                // As part of upgrading experience from lean mode into full mode, we lookup anything that is backed up in memory
                // from previous layout events and get them ready to go out to server as part of next upload.
                for (let entry of backup) {
                    container.push(entry);
                    metric.count(Metric.LayoutBytes, entry.length);
                }
                backup = [];
                backupBytes = 0;
                break;
            default:
                metric.count(Metric.InteractionBytes, event.length);
                break;
        }

        if (container) { container.push(event); }

        // Following two checks are precautionary and act as a fail safe mechanism to get out of unexpected situations.
        // Check 1: If for any reason the upload hasn't happened after waiting for 2x the config.delay time,
        // reset the timer. This allows Clarity to attempt an upload again.
        if (now - queuedTime > (config.delay * 2)) {
            clearTimeout(timeout);
            timeout = null;
        }

        // Check 2: Ideally, expectation is that pause / resume will work as designed and we will never hit the shutdown clause.
        // However, in some cases involving script errors, we may fail to pause Clarity instrumentation.
        // In those edge cases, we will cut the cord after a configurable shutdown value.
        // The only exception is the very last payload, for which we will attempt one final delivery to the server.
        if (now < config.shutdown && transmit && timeout === null) {
            if (type !== Event.Ping) { ping.reset(); }
            timeout = setTimeout(upload, config.delay);
            queuedTime = now;
        }
    }
}

export function end(): void {
    clearTimeout(timeout);
    upload(true);
    backupBytes = 0;
    queuedTime = 0;
    backup = [];
    events = [];
    transit = {};
    track = null;
    active = false;
}

function upload(final: boolean = false): void {
    timeout = null;
    performance.compute();
    target.compute();
    metric.compute();

    // Treat this as the last payload only if final boolean was explicitly set to true.
    // In real world tests, we noticed that certain third party scripts (e.g. https://www.npmjs.com/package/raven-js)
    // could inject function arguments for internal tracking (likely stack traces for script errors).
    // For these edge cases, we want to ensure that an injected object (e.g. {"key": "value"}) isn't mistaken to be true.
    let last = final === true;
    let payload: EncodedPayload = { e: JSON.stringify(metadata.envelope(last)), d: `[${events.join()}]` };
    let data = stringify(payload);
    let sequence = metadata.state.envelope.sequence;
    metric.count(Metric.TotalBytes, data.length);
    send(data, sequence, last);

    // Send data to upload hook, if defined in the config
    if (config.upload) { config.upload(data, sequence, last); }

    // Clear out events now that payload has been dispatched
    events = [];
}

function stringify(payload: EncodedPayload): string {
    return `{"e":${payload.e},"d":${payload.d}}`;
}

function send(data: string, sequence: number, last: boolean): void {
    // Upload data if a valid URL is defined in the config
    if (config.url.length > 0) {
        let dispatched = false;

        // If it's the last payload, attempt to upload using sendBeacon first.
        // The advantage to using sendBeacon is that browser can decide to upload asynchronously, improving chances of success
        // However, we don't want to rely on it for every payload, since we have no ability to retry if the upload failed.
        if (last && "sendBeacon" in navigator) {
            dispatched = navigator.sendBeacon(config.url, data);
        }

        // Before initiating XHR upload, we check if the data has already been uploaded using sendBeacon
        // There are two cases when dispatched could still be false:
        //   a) It's not the last payload, and therefore we didn't attempt sending sendBeacon
        //   b) It's the last payload, however, we failed to queue sendBeacon call and need to now fall back to XHR.
        //      E.g. if data is over 64KB, several user agents (like Chrome) will reject to queue the sendBeacon call.
        if (dispatched === false) {
            if (sequence in transit) { transit[sequence].attempts++; } else { transit[sequence] = { data, attempts: 1 }; }
            let xhr = new XMLHttpRequest();
            xhr.open("POST", config.url);
            if (sequence !== null) { xhr.onreadystatechange = (): void => { measure(check)(xhr, sequence, last); }; }
            xhr.send(data);
        }
    }
}

function check(xhr: XMLHttpRequest, sequence: number, last: boolean): void {
    if (xhr && xhr.readyState === XMLHttpRequest.DONE && sequence in transit) {
        if ((xhr.status < 200 || xhr.status > 208) && transit[sequence].attempts <= MAX_RETRIES) {
            send(transit[sequence].data, sequence, last);
        } else {
            track = { sequence, attempts: transit[sequence].attempts, status: xhr.status };
            // Send back an event only if we were not successful in our first attempt
            if (transit[sequence].attempts > 1) { encode(Event.Upload); }
            delete transit[sequence];
        }
    }
}
