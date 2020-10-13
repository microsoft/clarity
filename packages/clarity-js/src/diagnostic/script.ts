import { Constant, Event, Setting } from "@clarity-types/data";
import { ScriptErrorData } from "@clarity-types/diagnostic";
import { bind } from "@src/core/event";
import * as box from "@src/layout/box";
import encode from "./encode";

let history: { [key: string]: number } = {};
export let data: ScriptErrorData;

export function start(): void {
    bind(window, "error", handler);
    history = {};
}

function handler(error: ErrorEvent): boolean {
    let e = error["error"] || error;
    // While rare, it's possible for code to fail repeatedly during the lifetime of the same page
    // In those cases, we only want to log the failure first few times and not spam logs with redundant information.
    if (!(e.message in history)) { history[e.message] = 0; }
    if (history[e.message]++ >= Setting.ScriptErrorLimit) { return true; }

    // Send back information only if the handled error has valid information
    if (e && e.message) {
        data = {
            message: e.message,
            line: error["lineno"],
            column: error["colno"],
            stack: e.stack,
            source: error["filename"]
        };

        // In certain cases, ResizeObserver could lead to flood of benign errors - especially when video element is involved.
        // Reference Chromium issue: https://bugs.chromium.org/p/chromium/issues/detail?id=809574
        // Even though it doesn't impact user experience, or show up in console, it can still flood error reporting through on error
        // To mitigate that, we turn off Clarity's ResizeObserver on getting the first instance of this error
        if (e.message.indexOf(Constant.ResizeObserver) >= 0) {
            box.stop();
            return false;
        }

        encode(Event.ScriptError);
    }

    return true;
}
