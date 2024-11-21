import { Report } from "@clarity-types/core";
import config from "@src/core/config";
import { data } from "@src/data/envelope";

let history: string[];

export function reset(): void {
    history = [];
}

export function report(e: Error): Error {
    // Do not report the same message twice for the same page
    if (history && history.indexOf(e.message) === -1) {
        const url = config.report;
        if (url && url.length > 0) {
            let payload: Report = {v: data.version, p: data.projectId, u: data.userId, s: data.sessionId, n: data.pageNum};
            if (e.message) { payload.m = e.message; }
            if (e.stack) { payload.e = e.stack; }

            let dispatched = false;

            // Using POST request instead of a GET request (img-src) to not violate existing CSP rules
            // Use navigator.sendBeacon if available, otherwise fallback to XMLHttpRequest
            if ("sendBeacon" in navigator) {
                try {
                    // Navigator needs to be bound to sendBeacon before it is used to avoid errors in some browsers
                    dispatched = navigator.sendBeacon.bind(navigator)(url, JSON.stringify(payload));
                } catch { /* do nothing - and we will automatically fallback to XHR below */ }
            }

            if (dispatched === false) {
                let xhr = new XMLHttpRequest();
                xhr.open("POST", url, true);
                xhr.send(JSON.stringify(payload));
            }
            
            history.push(e.message);
        }
    }
    return e;
}
