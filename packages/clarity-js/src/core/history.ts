import { Code, Constant, Setting, Severity } from "@clarity-types/data";
import * as clarity from "@src/clarity";
import { bind } from "@src/core/event";
import * as log from "@src/diagnostic/log";

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
        log.log(Code.CallStackDepth, null, Severity.Info);
        return false;
    }
    return true;
}

function compute(): void {
    if (url !== getCurrentUrl() && count <= Setting.CallStackDepth) {
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
