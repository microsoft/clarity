import { UploadCallback } from "@clarity-types/core";
import { BooleanFlag, Check, Code, Constant, EncodedPayload, Event, Metric, Setting, Severity, Token, Transit, UploadData, XMLReadyState } from "@clarity-types/data";
import * as clarity from "@src/clarity";
import config from "@src/core/config";
import measure from "@src/core/measure";
import { time } from "@src/core/time";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import compress from "@src/data/compress";
import encode from "@src/data/encode";
import * as envelope from "@src/data/envelope";
import * as data from "@src/data/index";
import * as limit from "@src/data/limit";
import * as metadata from "@src/data/metadata";
import * as metric from "@src/data/metric";
import * as ping from "@src/data/ping";
import * as internal from "@src/diagnostic/internal";
import * as timeline from "@src/interaction/timeline";
import * as region from "@src/layout/region";
import * as extract from "@src/data/extract";
import * as style from "@src/layout/style";
import { report } from "@src/core/report";
import { signalsEvent } from "@src/data/signal";
import { snapshot } from "@src/insight/snapshot";
import * as dynamic from "@src/core/dynamic";

let discoverBytes: number = 0;
let playbackBytes: number = 0;
let playback: string[];
let analysis: string[];
let timeout: number = null;
let transit: Transit;
let active: boolean;
let queuedTime: number = 0;
let leanLimit = false;
export let track: UploadData;

export function start(): void {
    active = true;
    discoverBytes = 0;
    playbackBytes = 0;
    leanLimit = false;
    queuedTime = 0;
    playback = [];
    analysis = [];
    transit = {};
    track = null;
}

export function queue(tokens: Token[], transmit: boolean = true): void {
    if (!active) {
        return;
    }

    let now = time();
    let type = tokens.length > 1 ? tokens[1] : null;
    let event = JSON.stringify(tokens);

    if (!config.lean) {
        leanLimit = false;
    } else if (!leanLimit && playbackBytes + event.length > Setting.PlaybackBytesLimit) {
        internal.log(Code.LeanLimit, Severity.Info);
        leanLimit = true;
    }

    switch (type) {
        case Event.Discover:
            if (leanLimit) { break; }
            discoverBytes += event.length;
        case Event.Box:
        case Event.Mutation:
        case Event.Snapshot:
        case Event.StyleSheetAdoption:
        case Event.StyleSheetUpdate:
        case Event.Animation:
        case Event.CustomElement:
            if (leanLimit) { break; }
            playbackBytes += event.length;
            playback.push(event);
            break;
        default:
            analysis.push(event);
            break;
    }

    // Increment event count metric
    metric.count(Metric.EventCount);

    // Following two checks are precautionary and act as a fail safe mechanism to get out of unexpected situations.
    // Check 1: If for any reason the upload hasn't happened after waiting for 2x the config.delay time,
    // reset the timer. This allows Clarity to attempt an upload again.
    let gap = delay();
    if (now - queuedTime > (gap * 2)) {
        clearTimeout(timeout);
        timeout = null;
    }

    // Transmit Check: When transmit is set to true (default), it indicates that we should schedule an upload
    // However, in certain scenarios - like metric calculation - which are triggered as part of an existing upload
    // We enrich the data going out with the existing upload. In these cases, call to upload comes with 'transmit' set to false.
    if (transmit && timeout === null) {
        if (type !== Event.Ping) { ping.reset(); }
        timeout = setTimeout(upload, gap);
        queuedTime = now;
        limit.check(playbackBytes);
    }
}

export function stop(): void {
    clearTimeout(timeout);
    upload(true);
    discoverBytes = 0;
    playbackBytes = 0;
    leanLimit = false;
    queuedTime = 0;
    playback = [];
    analysis = [];
    transit = {};
    track = null;
    active = false;
}

async function upload(final: boolean = false): Promise<void> {
    if (!active) {
        return;
    }

    timeout = null;

    // Check if we can send playback bytes over the wire or not
    // For better instrumentation coverage, we send playback bytes from second sequence onwards
    // And, we only send playback metric when we are able to send the playback bytes back to server
    let sendPlaybackBytes = config.lean === false && playbackBytes > 0 && (playbackBytes < Setting.MaxFirstPayloadBytes || envelope.data.sequence > 0);
    if (sendPlaybackBytes) { metric.max(Metric.Playback, BooleanFlag.True); }

    // CAUTION: Ensure "transmit" is set to false in the queue function for following events
    // Otherwise you run a risk of infinite loop.
    region.compute();
    timeline.compute();
    data.compute();
    style.compute();

    // Treat this as the last payload only if final boolean was explicitly set to true.
    // In real world tests, we noticed that certain third party scripts (e.g. https://www.npmjs.com/package/raven-js)
    // could inject function arguments for internal tracking (likely stack traces for script errors).
    // For these edge cases, we want to ensure that an injected object (e.g. {"key": "value"}) isn't mistaken to be true.
    let last = final === true;
    
    // In some cases envelope has null data because it's part of the shutdown process while there's one upload call queued which might introduce runtime error
    if(!envelope.data) return;

    let e = JSON.stringify(envelope.envelope(last));
    let a = `[${analysis.join()}]`;

    let p = sendPlaybackBytes ? `[${playback.join()}]` : Constant.Empty;
    
    // For final (beacon) payloads, If size is too large, we need to remove playback data
    if (last && p.length > 0 && (e.length + a.length + p.length > Setting.MaxBeaconPayloadBytes)) {
        p = Constant.Empty;
    }

    let encoded: EncodedPayload = {e, a, p};

    // Get the payload ready for sending over the wire
    // We also attempt to compress the payload if it is not the last payload and the browser supports it
    // In all other cases, we continue to send back string value
    let payload = stringify(encoded);
    let zipped = last ? null : await compress(payload);
    metric.sum(Metric.TotalBytes, zipped ? zipped.length : payload.length);
    send(payload, zipped, envelope.data.sequence, last);

    // Clear out events now that payload has been dispatched
    analysis = [];
    if (sendPlaybackBytes) {
        playback = [];
        playbackBytes = 0;
        discoverBytes = 0;
        leanLimit = false;
    }
}

function stringify(encoded: EncodedPayload): string {
    return encoded.p.length > 0 ? `{"e":${encoded.e},"a":${encoded.a},"p":${encoded.p}}` : `{"e":${encoded.e},"a":${encoded.a}}`;
}

function send(payload: string, zipped: Uint8Array, sequence: number, beacon: boolean = false): void {
    // Upload data if a valid URL is defined in the config
    if (typeof config.upload === Constant.String) {
        const url = config.upload as string;
        let dispatched = false;

        // If it's the last payload, attempt to upload using sendBeacon first.
        // The advantage to using sendBeacon is that browser can decide to upload asynchronously, improving chances of success
        // However, we don't want to rely on it for every payload, since we have no ability to retry if the upload failed.
        // Also, in case of sendBeacon, we do not have a way to alter HTTP headers and therefore can't send compressed payload
        if (beacon && navigator && navigator["sendBeacon"]) {
            try {
                // Navigator needs to be bound to sendBeacon before it is used to avoid errors in some browsers
                dispatched = navigator.sendBeacon.bind(navigator)(url, payload);
                if (dispatched) { 
                    done(sequence); 
                }
            } catch(error) {
                // If sendBeacon fails, we do nothing and continue with XHR upload
            }
        }

        // Before initiating XHR upload, we check if the data has already been uploaded using sendBeacon
        // There are two cases when dispatched could still be false:
        //   a) It's not the last payload, and therefore we didn't attempt sending sendBeacon
        //   b) It's the last payload, however, we failed to queue sendBeacon call and need to now fall back to XHR.
        //      E.g. if data is over 64KB, several user agents (like Chrome) will reject to queue the sendBeacon call.
        if (dispatched === false) {
            // While tracking payload for retry, we only track string value of the payload to err on the safe side
            // Not all browsers support compression API and the support for it in supported browsers is still experimental
            if (sequence in transit) { transit[sequence].attempts++; } else { transit[sequence] = { data: payload, attempts: 1 }; }
            let xhr = new XMLHttpRequest();
            xhr.open("POST", url, true);
            xhr.timeout = Setting.UploadTimeout;
            xhr.ontimeout = () => { report(new Error(`${Constant.Timeout} : ${url}`)) };
            if (sequence !== null) { xhr.onreadystatechange = (): void => { measure(check)(xhr, sequence); }; }
            xhr.withCredentials = true;
            if (zipped) {
                // If we do have valid compressed array, send it with appropriate HTTP headers so server can decode it appropriately
                xhr.setRequestHeader(Constant.Accept, Constant.ClarityGzip);
                xhr.send(zipped);
            } else {
                // In all other cases, continue sending string back to the server
                xhr.send(payload);
            }
        }
    } else if (config.upload) {
        const callback = config.upload as UploadCallback;
        callback(payload);
        done(sequence);
    }
}

function check(xhr: XMLHttpRequest, sequence: number): void {
    var transitData = transit[sequence];
    if (xhr && xhr.readyState === XMLReadyState.Done && transitData) {
        // Attempt send payload again (as configured in settings) if we do not receive a success (2XX) response code back from the server
        if ((xhr.status < 200 || xhr.status > 208) && transitData.attempts <= Setting.RetryLimit) {
            // We re-attempt in all cases except when server explicitly rejects our request with 4XX error
            if (xhr.status >= 400 && xhr.status < 500) {
                // In case of a 4XX response from the server, we bail out instead of trying again
                limit.trigger(Check.Server);
            } else {
                // Browser will send status = 0 when it refuses to put network request over the wire
                // This could happen for several reasons, couple of known ones are:
                //    1: Browsers block upload because of content security policy violation
                //    2: Safari will terminate pending XHR requests with status code 0 if the user navigates away from the page
                // In any case, we switch the upload URL to fallback configuration (if available) before re-trying one more time
                if (xhr.status === 0) { config.upload = config.fallback ? config.fallback : config.upload; }
                // Capture the status code and number of attempts so we can report it back to the server
                track = { sequence, attempts: transitData.attempts, status: xhr.status };
                encode(Event.Upload);
                // In all other cases, re-attempt sending the same data
                // For retry we always fallback to string payload, even though we may have attempted
                // sending zipped payload earlier
                send(transitData.data, null, sequence);
            }
        } else {
            track = { sequence, attempts: transitData.attempts, status: xhr.status };
            // Send back an event only if we were not successful in our first attempt
            if (transitData.attempts > 1) { encode(Event.Upload); }
            // Handle response if it was a 200 response with a valid body
            if (xhr.status === 200 && xhr.responseText) { response(xhr.responseText); }
            // If we exhausted our retries then trigger Clarity's shutdown for this page since the data will be incomplete
            if (xhr.status === 0) {
                // And, right before we terminate the session, we will attempt one last time to see if we can use
                // different transport option (sendBeacon vs. XHR) to get this data to the server for analysis purposes
                send(transitData.data, null, sequence, true);
                limit.trigger(Check.Retry);
            }
            // Signal that this request completed successfully
            if (xhr.status >= 200 && xhr.status <= 208) { done(sequence); }
            // Stop tracking this payload now that it's all done
            delete transit[sequence];
        }
    }
}

function done(sequence: number): void {
    // If we everything went successfully, and it is the first sequence, save this session for future reference
    if (sequence === 1) {
        metadata.save();
        metadata.callback();
    }
}

function delay(): number {
    // Progressively increase delay as we continue to send more payloads from the client to the server
    // If we are not uploading data to a server, and instead invoking UploadCallback, in that case keep returning configured value
    let gap = config.lean === false && discoverBytes > 0 ? Setting.MinUploadDelay : envelope.data.sequence * config.delay;
    return typeof config.upload === Constant.String ? Math.max(Math.min(gap, Setting.MaxUploadDelay), Setting.MinUploadDelay) : config.delay;
}

function response(payload: string): void {
    let lines = payload && payload.length > 0 ? payload.split("\n") : [];
    for (var line of lines)
    {
        let parts = line && line.length > 0 ? line.split(/ (.*)/) : [Constant.Empty];
        switch (parts[0]) {
            case Constant.End:
                // Clear out session storage and end the session so we can start fresh the next time
                limit.trigger(Check.Server);
                break;
            case Constant.Upgrade:
                // Upgrade current session to send back playback information
                clarity.upgrade(Constant.Auto);
                break;
            case Constant.Action:
                // Invoke action callback, if configured and has a valid value
                if (config.action && parts.length > 1) { config.action(parts[1]); }
                break;
            case Constant.Extract:
                if (parts.length > 1) { extract.trigger(parts[1]); }
                break;
            case Constant.Signal:
                if (parts.length > 1) { signalsEvent(parts[1]); }
                break;
            case Constant.Module:
                if (parts.length > 1) {
                    dynamic.event(parts[1]);
                }
                break;
            case Constant.Snapshot:
                config.lean = false; // Disable lean mode to ensure we can send playback information to server.
                snapshot();
                break;
        }
    }
}
