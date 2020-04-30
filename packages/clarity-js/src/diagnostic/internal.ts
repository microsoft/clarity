import { Code, Event } from "@clarity-types/data";
import { InternalErrorData } from "@clarity-types/diagnostic";
import encode from "./encode";

let history: { [key: number]: string[] } = {};
export let data: InternalErrorData;

export function error(code: Code, err: Error): void {
    let errorKey = err ? `${err.name}|${err.message}`: "";
    // While rare, it's possible for code to fail repeatedly during the lifetime of the same page
    // In those cases, we only want to log the failure once and not spam logs with redundant information.
    if (code in history && history[code].indexOf(errorKey) >= 0) { return; }

    data = {
        code,
        name: err ? err.name : null,
        message: err ? err.message : null
    };

    // Maintain history of errors in memory to avoid sending redundant information
    if (code in history) { history[code].push(errorKey); } else { history[code] = [errorKey]; }

    encode(Event.InternalError);
}

export function reset(): void {
    history = {};
}