import { Constant, EncodedPayload, Event, Metric, Token, Transit, UploadData } from "@clarity-types/data";
import * as clarity from "@src/clarity";
import config from "@src/core/config";
import measure from "@src/core/measure";
import { time } from "@src/core/time";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import encode from "@src/data/encode";
import * as envelope from "@src/data/envelope";
import * as data from "@src/data/index";
import * as metric from "@src/data/metric";
import * as ping from "@src/data/ping";
import * as timeline from "@src/interaction/timeline";
import * as region from "@src/layout/region";
import * as performance from "@src/performance/observer";

const MAX_RETRIES = 2;
const MAX_PLAYBACK_BYTES = 10 * 1024 * 1024; // 10MB
let playbackBytes: number = 0;
let playback: string[];
let analysis: string[];
let timeout: number = null;
let transit: Transit;
let active: boolean;
let queuedTime: number = 0;
export let track: UploadData;

export function start(): void {
    active = true;
    playbackBytes = 0;
    queuedTime = 0;
    playback = [];
    analysis = [];
    transit = {};
    track = null;
}

export function queue(tokens: Token[], transmit: boolean = true): void {
    if (active) {
        let now = time();
        let type = tokens.length > 1 ? tokens[1] : null;
        let event = JSON.stringify(tokens);

        switch (type) {
            case Event.Discover:
            case Event.Mutation:
                // At the moment, we limit playback to grow until MAX_PLAYBACK_BYTES. Anytime we grow past this size, we start dropping events.
                // This is not ideal, and more of a fail safe mechanism.
                playbackBytes += event.length;
                if (playbackBytes < MAX_PLAYBACK_BYTES) { playback.push(event); }
                break;
            default:
                analysis.push(event);
                break;
        }

        // Following two checks are precautionary and act as a fail safe mechanism to get out of unexpected situations.
        // Check 1: If for any reason the upload hasn't happened after waiting for 2x the config.delay time,
        // reset the timer. This allows Clarity to attempt an upload again.
        if (now - queuedTime > (config.delay * 2)) {
            clearTimeout(timeout);
            timeout = null;
        }

        // Failsafe Check: If the failsafe limit is set, and we hit the limit on number of payloads for this page, we will stop scheduling more uploads.
        // The only exception is the very last payload, for which we will attempt one final delivery to the server.
        if (config.failsafe && envelope.data.sequence >= config.failsafe) { transmit = false; }

        // Shutdown Check: Ideally, expectation is that pause / resume will work as designed and we will never hit the shutdown clause.
        // However, in some cases involving script errors, we may fail to pause Clarity instrumentation.
        // In those edge cases, we will cut the cord after a configurable shutdown value.
        // The only exception is the very last payload, for which we will attempt one final delivery to the server.
        // Transmit Check: When transmit is set to true (default), it indicates that we should schedule an upload
        // However, in certain scenarios - like metric calculation - which are triggered as part of an existing upload
        // We enrich the data going out with the existing upload. In these cases, call to upload comes with 'transmit' set to false.
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
    playbackBytes = 0;
    queuedTime = 0;
    playback = [];
    analysis = [];
    transit = {};
    track = null;
    active = false;
}

function upload(final: boolean = false): void {
    timeout = null;

    // CAUTION: Ensure "transmit" is set to false in the queue function for following events
    // Otherwise you run a risk of infinite loop.
    performance.compute();
    region.compute();
    timeline.compute();
    data.compute();

    // Treat this as the last payload only if final boolean was explicitly set to true.
    // In real world tests, we noticed that certain third party scripts (e.g. https://www.npmjs.com/package/raven-js)
    // could inject function arguments for internal tracking (likely stack traces for script errors).
    // For these edge cases, we want to ensure that an injected object (e.g. {"key": "value"}) isn't mistaken to be true.
    let last = final === true;
    let a = `[${analysis.join()}]`;
    let p = config.lean ? Constant.EMPTY_STRING : `[${playback.join()}]`;
    let encoded: EncodedPayload = {e: JSON.stringify(envelope.envelope(last)), a, p};
    let payload = stringify(encoded);
    let sequence = envelope.data.sequence;
    metric.sum(Metric.TotalBytes, payload.length);
    send(payload, sequence, last);

    // Send data to upload hook, if defined in the config
    if (config.upload) { config.upload(payload); }

    // Clear out events now that payload has been dispatched
    analysis = [];
    if (!config.lean) {
        playback = [];
        playbackBytes = 0;
    }
}

function stringify(encoded: EncodedPayload): string {
    return encoded.p.length > 0 ? `{"e":${encoded.e},"a":${encoded.a},"p":${encoded.p}}` : `{"e":${encoded.e},"a":${encoded.a}}`;
}

function send(payload: string, sequence: number, last: boolean): void {
    // Upload data if a valid URL is defined in the config
    if (config.url.length > 0) {
        let dispatched = false;

        // If it's the last payload, attempt to upload using sendBeacon first.
        // The advantage to using sendBeacon is that browser can decide to upload asynchronously, improving chances of success
        // However, we don't want to rely on it for every payload, since we have no ability to retry if the upload failed.
        if (last && "sendBeacon" in navigator) {
            dispatched = navigator.sendBeacon(config.url, payload);
        }

        // Before initiating XHR upload, we check if the data has already been uploaded using sendBeacon
        // There are two cases when dispatched could still be false:
        //   a) It's not the last payload, and therefore we didn't attempt sending sendBeacon
        //   b) It's the last payload, however, we failed to queue sendBeacon call and need to now fall back to XHR.
        //      E.g. if data is over 64KB, several user agents (like Chrome) will reject to queue the sendBeacon call.
        if (dispatched === false) {
            if (sequence in transit) { transit[sequence].attempts++; } else { transit[sequence] = { data: payload, attempts: 1 }; }
            let xhr = new XMLHttpRequest();
            xhr.open("POST", config.url);
            if (sequence !== null) { xhr.onreadystatechange = (): void => { measure(check)(xhr, sequence, last); }; }
            xhr.send(payload);
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
            // Handle response if it was a 200 or 500 status response with a valid body
            if ((xhr.status === 200 || xhr.status === 500) && xhr.responseText) { response(xhr.responseText); }
            // Stop tracking this payload now that it's all done
            delete transit[sequence];
        }
    }
}

function response(payload: string): void {
    let key = payload && payload.length > 0 ? payload.split(" ")[0] : Constant.EMPTY_STRING;
    switch (key) {
        case Constant.RESPONSE_END:
            clarity.end();
            break;
        case Constant.RESPONSE_UPGRADE:
            clarity.upgrade(Constant.AUTO);
            break;
    }
}
