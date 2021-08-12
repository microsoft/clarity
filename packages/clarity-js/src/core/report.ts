import { Report } from "@clarity-types/core";
import { Check } from "@clarity-types/data";
import config from "@src/core/config";
import { data } from "@src/data/metadata";

let history: string[];

export function reset(): void {
    history = [];
}

export function report(check: Check, message: string = null): void {
    // Do not report the same message twice for the same page
    if (history && history.indexOf(message) === -1) {
        const url = config.report;
        if (url && url.length > 0) {
            let payload: Report = {c: check, p: data.projectId, u: data.userId, s: data.sessionId, n: data.pageNum };
            if (message) payload.m = message;
            // Using POST request instead of a GET request (img-src) to not violate existing CSP rules
            // Since, Clarity already uses XHR to upload data, we stick with similar POST mechanism for reporting too
            let xhr = new XMLHttpRequest();
            xhr.open("POST", url);
            xhr.send(JSON.stringify(payload));
            history.push(message);
        }
    }
}
