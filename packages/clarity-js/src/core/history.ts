import { Setting } from "@clarity-types/data"
import * as clarity from "@src/clarity";
import { bind } from "@src/core/event";

let pushState = null;
let replaceState = null;
let url = null;

export function start(): void {
    url = location.href;
    bind(window, "popstate", compute);
    
    // Add a proxy to history.pushState function
    if (pushState === null) { pushState = history.pushState; }
    history.pushState = function(): void {
        pushState.apply(this, arguments);
        compute();
    };

    // Add a proxy to history.replaceState function
    if (replaceState === null) { replaceState = history.replaceState; }
    history.replaceState = function(): void {
        replaceState.apply(this, arguments);
        compute();
    };
}

function compute(): void {
    if (url !== location.href) {
        clarity.stop();
        window.setTimeout(clarity.start, Setting.RestartDelay);
    }
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
}
