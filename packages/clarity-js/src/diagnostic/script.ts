import { Event, Setting } from "@clarity-types/data";
import { ScriptErrorData } from "@clarity-types/diagnostic";
import { bind } from "@src/core/event";
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

        encode(Event.ScriptError);
    }

    return true;
}
