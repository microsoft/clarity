import { Report } from "@clarity-types/core";
import config from "@src/core/config";
import { data } from "@src/data/metadata";

let history: string[];

export function reset(): void {
    history = [];
}

export function report(message: string): void {
    // Do not report the same message twice for the same page
    if (history && history.indexOf(message) === -1) {
        const url = config.report;
        if (url && url.length > 0) {
            let payload = JSON.stringify({m: message, p: data.projectId, u: data.userId, s: data.sessionId, n: data.pageNum} as Report);
            let xhr = new XMLHttpRequest();
            xhr.open("POST", url);
            xhr.send(payload);
            history.push(message);
        }
    }
}
