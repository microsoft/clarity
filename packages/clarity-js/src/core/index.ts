import { Config } from "@clarity-types/core";
import { Constant } from "@clarity-types/data";
import configuration from "@src/core/config";
import * as event from "@src/core/event";
import * as history from "@src/core/history";
import * as report from "@src/core/report";
import * as task from "@src/core/task";
import * as time from "@src/core/time";
import * as clarity from "@src/clarity";
import * as custom from "@src/data/custom";

let status = false;

export function start(): void {
    status = true;
    time.start();
    task.reset();
    event.reset();
    report.reset();
    history.start();
}

export function stop(): void {
    history.stop();
    report.reset();
    event.reset();
    task.reset();
    time.stop();
    status = false;
}

export function active(): boolean {
    return status;
}

export function check(): boolean {
    try {
        return status === false &&
            typeof Promise !== "undefined" &&
            window["MutationObserver"] &&
            document["createTreeWalker"] &&
            "now" in Date &&
            "now" in performance &&
            typeof WeakMap !== "undefined";
    } catch (ex) {
        return false;
    }
}

export function config(override: Config): boolean {
    // Process custom configuration overrides, if available
    if (override === null || status) { return false; }
    for (let key in override) {
        if (key in configuration) { configuration[key] = override[key]; }
    }
    return true;
}

// Suspend ends the current Clarity instance after a configured timeout period
// The way it differs from the "end" call is that it starts listening to
// user interaction events as soon as it terminates existing clarity instance.
// On the next interaction, it automatically starts another instance under a different page id
// E.g. if configured timeout is 10m, and user stays inactive for an hour.
// In this case, we will suspend clarity after 10m of inactivity and after another 50m when user interacts again
// Clarity will restart and start another instance seamlessly. Effectively not missing any active time, but also
// not holding the session during inactive time periods.
export function suspend(): void {
    if (status) {
        custom.event(Constant.Clarity, Constant.Suspend);
        clarity.stop();
        ["mousemove", "touchstart"].forEach(x => event.bind(document, x, restart));
        ["resize", "scroll", "pageshow"].forEach(x => event.bind(window, x, restart));
    }
}

function restart(): void {
    clarity.start();
    custom.event(Constant.Clarity, Constant.Restart);
}
