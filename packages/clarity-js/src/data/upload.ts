import { UploadCallback } from "@clarity-types/core";
import { BooleanFlag, Check, Constant, EncodedPayload, Event, Metric, Setting, Token, Transit, UploadData, XMLReadyState } from "@clarity-types/data";
import * as clarity from "@src/clarity";
import config from "@src/core/config";
import measure from "@src/core/measure";
import { time } from "@src/core/time";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import encode from "@src/data/encode";
import * as envelope from "@src/data/envelope";
import * as data from "@src/data/index";
import * as limit from "@src/data/limit";
import * as metric from "@src/data/metric";
import * as ping from "@src/data/ping";
import * as timeline from "@src/interaction/timeline";
import * as region from "@src/layout/region";

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
            case Event.Box:
            case Event.Discover:
            case Event.Mutation:
                playbackBytes += event.length;
                playback.push(event);
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

        // Transmit Check: When transmit is set to true (default), it indicates that we should schedule an upload
        // However, in certain scenarios - like metric calculation - which are triggered as part of an existing upload
        // We enrich the data going out with the existing upload. In these cases, call to upload comes with 'transmit' set to false.
        if (transmit && timeout === null) {
            if (type !== Event.Ping) { ping.reset(); }
            timeout = setTimeout(upload, config.delay);
            queuedTime = now;
            limit.check(playbackBytes);
        }
    }
}

export function stop(): void {
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

    // Check if we can send playback bytes over the wire or not
    // For better instrumentation coverage, we send playback bytes from second sequence onwards
    // And, we only send playback metric when we are able to send the playback bytes back to server
    let sendPlaybackBytes = config.lean === false && envelope.data.sequence > 0;
    if (sendPlaybackBytes && playback && playback.length > 0) { metric.max(Metric.Playback, BooleanFlag.True); }

    // CAUTION: Ensure "transmit" is set to false in the queue function for following events
    // Otherwise you run a risk of infinite loop.
    region.compute();
    timeline.compute();
    data.compute();

    // Treat this as the last payload only if final boolean was explicitly set to true.
    // In real world tests, we noticed that certain third party scripts (e.g. https://www.npmjs.com/package/raven-js)
    // could inject function arguments for internal tracking (likely stack traces for script errors).
    // For these edge cases, we want to ensure that an injected object (e.g. {"key": "value"}) isn't mistaken to be true.
    let last = final === true;
    let e = JSON.stringify(envelope.envelope(last));
    let a = `[${analysis.join()}]`;

    let p = sendPlaybackBytes ? `[${playback.join()}]` : Constant.Empty;
    let encoded: EncodedPayload = {e, a, p};
    let payload = stringify(encoded);
    metric.sum(Metric.TotalBytes, payload.length);
    send(payload, envelope.data.sequence, last);

    // Clear out events now that payload has been dispatched
    analysis = [];
    if (sendPlaybackBytes) {
        playback = [];
        playbackBytes = 0;
    }
}

function stringify(encoded: EncodedPayload): string {
    return encoded.p.length > 0 ? `{"e":${encoded.e},"a":${encoded.a},"p":${encoded.p}}` : `{"e":${encoded.e},"a":${encoded.a}}`;
}

function send(payload: string, sequence: number, beacon: boolean): void {
    // Upload data if a valid URL is defined in the config
    if (typeof config.upload === Constant.String && config.server) {
        const url = `${config.server}/${config.upload}`;
        let dispatched = false;

        // If it's the last payload, attempt to upload using sendBeacon first.
        // The advantage to using sendBeacon is that browser can decide to upload asynchronously, improving chances of success
        // However, we don't want to rely on it for every payload, since we have no ability to retry if the upload failed.
        if (beacon && "sendBeacon" in navigator) {
            dispatched = navigator.sendBeacon(url, payload);
        }

        // Before initiating XHR upload, we check if the data has already been uploaded using sendBeacon
        // There are two cases when dispatched could still be false:
        //   a) It's not the last payload, and therefore we didn't attempt sending sendBeacon
        //   b) It's the last payload, however, we failed to queue sendBeacon call and need to now fall back to XHR.
        //      E.g. if data is over 64KB, several user agents (like Chrome) will reject to queue the sendBeacon call.
        if (dispatched === false) {
            if (sequence in transit) { transit[sequence].attempts++; } else { transit[sequence] = { data: payload, attempts: 1 }; }
            let xhr = new XMLHttpRequest();
            xhr.open("POST", url);
            if (sequence !== null) { xhr.onreadystatechange = (): void => { measure(check)(xhr, sequence, beacon); }; }
            xhr.withCredentials = true;
            xhr.send(payload);
        }
    } else if (config.upload) {
        const callback = config.upload as UploadCallback;
        callback(payload);
    }
}

function check(xhr: XMLHttpRequest, sequence: number, last: boolean): void {
    var transitData = transit[sequence];
    if (xhr && xhr.readyState === XMLReadyState.Done && transitData) {
        // Attempt send payload again (as configured in settings) if we do not receive a success (2XX) response code back from the server
        if ((xhr.status < 200 || xhr.status > 208) && transitData.attempts <= Setting.RetryLimit) {
            // We re-attempt in all cases except two: 
            //     0: Indicates the browser has not put the request on the wire and therefore we need to attempt sendBeacon API before giving up
            //   4XX: Indicates the server has rejected the response for bad payload and therefore we terminate the session
            if (xhr.status === 0) {
                // The observed behavior is that Safari will terminate pending XHR requests with status code 0
                // if the user navigates away from the page. In these cases, we fallback to the else clause and lose the data
                // By explicitly handing status code 0 we attempt to try a different transport (sendBeacon vs. XHR) before giving up.
                send(transitData.data, sequence, true);
            } else if (xhr.status >= 400 && xhr.status < 500) {
                // Anytime we receive a 4XX response from the server, we bail out instead of trying again
                limit.trigger(Check.Server);
            } else {
                // In all other cases, re-attempt sending the same data
                send(transitData.data, sequence, last);
            }
        } else {
            track = { sequence, attempts: transitData.attempts, status: xhr.status };
            // Send back an event only if we were not successful in our first attempt
            if (transitData.attempts > 1) { encode(Event.Upload); }
            // Handle response if it was a 200 response with a valid body
            if (xhr.status === 200 && xhr.responseText) { response(xhr.responseText); }
            // If we exhausted our retries then trigger Clarity shutdown for this page.
            // The only exception is if browser decided to not even put the request on the network (status code: 0)
            if (transitData.attempts > Setting.RetryLimit && xhr.status !== 0) { limit.trigger(Check.Retry); }
            // Stop tracking this payload now that it's all done
            delete transit[sequence];
        }
    }
}

function response(payload: string): void {
    let key = payload && payload.length > 0 ? payload.split(" ")[0] : Constant.Empty;
    switch (key) {
        case Constant.End:
            // Clear out session storage and end the session so we can start fresh the next time
            limit.trigger(Check.Server);
            break;
        case Constant.Upgrade:
            // Upgrade current session to send back playback information
            clarity.upgrade(Constant.Auto);
            break;
    }
}
