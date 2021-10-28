import { Code, Constant, Setting, Severity } from "@clarity-types/data";
import * as clarity from "@src/clarity";
import { bind } from "@src/core/event";
import * as internal from "@src/diagnostic/internal";

let pushState = null;
let replaceState = null;
let url = null;
let count = 0;

export function start(): void {
    url = getCurrentUrl();
    count = 0;
    bind(window, "popstate", compute);
    
    // Add a proxy to history.pushState function
    if (pushState === null) { pushState = history.pushState; }
    history.pushState = function(): void {
        if (check()) {
            pushState.apply(this, arguments);
            compute();
        }
    };

    // Add a proxy to history.replaceState function
    if (replaceState === null) { replaceState = history.replaceState; }
    history.replaceState = function(): void {
        if (check()) {
            replaceState.apply(this, arguments);
            compute();
        }
    };
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
        window.setTimeout(clarity.start, Setting.RestartDelay);
    }
}

function getCurrentUrl(): string {
    return location.href ? location.href.replace(location.hash, Constant.Empty) : location.href;
}

export function stop(): void {
    // Restore original function definition of history.pushState
    if (pushState !== null) {
        history.pushState = pushState;
        pushState = null;
    }

    // Restore original function definition of history.replaceState
    if (replaceState !== null) {
        history.replaceState = replaceState;
        replaceState = null;
    }
    
    url = null;
    count = 0;
}
