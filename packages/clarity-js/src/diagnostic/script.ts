import { Event } from "@clarity-types/data";
import { ScriptErrorData } from "@clarity-types/diagnostic";
import { bind } from "@src/core/event";
import encode from "@src/diagnostic/encode";

export let data: ScriptErrorData;

export function start(): void {
    bind(window, "error", handler);
}

function handler(error: ErrorEvent): void {
    let e = error["error"] || error;

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
}
