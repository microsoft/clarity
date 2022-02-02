import { Code, Event, Severity } from "@clarity-types/data";
import { LogData } from "@clarity-types/diagnostic";
import encode from "./encode";

let history: { [key: number]: string[] } = {};
export let data: LogData;

export function start(): void {
    history = {};
}

export function log(code: Code, severity: Severity, name: string = null, message: string = null, stack: string = null): void {
    let key = name ? `${name}|${message}`: "";
    // While rare, it's possible for code to fail repeatedly during the lifetime of the same page
    // In those cases, we only want to log the failure once and not spam logs with redundant information.
    if (code in history && history[code].indexOf(key) >= 0) { return; }

    data = { code, name, message, stack, severity };

    // Maintain history of errors in memory to avoid sending redundant information
    if (code in history) { history[code].push(key); } else { history[code] = [key]; }

    encode(Event.Log);
}

export function stop(): void {
    history = {};
}
