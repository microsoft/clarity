import { BooleanFlag, Code, Constant, Metric, Setting, Severity } from "@clarity-types/data";
import * as clarity from "@src/clarity";
import * as core from "@src/core"
import { bind } from "@src/core/event";
import * as internal from "@src/diagnostic/internal";
import * as metric from "@src/data/metric";

let pushState = null;
let replaceState = null;
let url = null;
let count = 0;

export function start(): void {
    url = getCurrentUrl();
    count = 0;
    bind(window, "popstate", compute);
    pushState = proxyHistory(pushState, "pushState");
    replaceState = proxyHistory(replaceState, "replaceState");
}

function proxyHistory(original: Function, method: string): Function {
    if (original === null) {
        try {
            original = history[method];
            history[method] = function(): void {
                original.apply(this, arguments);
                if (core.active() && check()) {
                    compute();
                }
            };
        } catch (e) {
            // history method may be readonly (e.g., Safari iOS WKWebView)
            original = null;
        }
    }
    return original;
}

function check(): boolean {
    if (count++ > Setting.CallStackDepth) {
        internal.log(Code.CallStackDepth, Severity.Info);
        return false;
    }
    return true;
}

function compute(): void {
    count = 0; // Reset the counter
    if (url !== getCurrentUrl()) {
        // If the url changed, start tracking it as a new page
        clarity.stop();
        window.setTimeout(restart, Setting.RestartDelay);
    }
}

function restart(): void {
    clarity.start();
    metric.max(Metric.SinglePage, BooleanFlag.True);
}

function getCurrentUrl(): string {
    return location.href ? location.href.replace(location.hash, Constant.Empty) : location.href;
}

export function stop(): void {
    url = null;
    count = 0;
}
