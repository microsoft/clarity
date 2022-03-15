import { Code, Constant, Setting, Severity } from "@clarity-types/data";
import * as clarity from "@src/clarity";
import { bind } from "@src/core/event";
import * as internal from "@src/diagnostic/internal";

let pushState = history.pushState;
let replaceState = history.replaceState;
let enabled = false;
let url = null;
let count = 0;

// Add a proxy to history.pushState function
history.pushState = function(): void {
    // If Clarity is disabled, bypass its History API proxy
    if (!enabled) {
        return pushState.apply(this, arguments);
    }

    if (check()) {
        pushState.apply(this, arguments);
        compute();
    }
};

// Add a proxy to history.replaceState function
history.replaceState = function(): void {
    // If Clarity is disabled, bypass its History API proxy
    if (!enabled) {
        return replaceState.apply(this, arguments);
    }

    if (check()) {
        replaceState.apply(this, arguments);
        compute();
    }
};

export function start(): void {
    url = getCurrentUrl();
    count = 0;
    enabled = true;
    bind(window, "popstate", compute);
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
    enabled = false;
    url = null;
    count = 0;
}
