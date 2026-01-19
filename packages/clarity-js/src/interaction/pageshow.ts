import { Constant } from "@clarity-types/core";
import { Code, Severity } from "@clarity-types/data";
import * as clarity from "@src/clarity";
import api from "@src/core/api";
import measure from "@src/core/measure";
import * as internal from "@src/diagnostic/internal";

let bound = false;

export function start(): void {
    // Only bind once - this listener must persist even when Clarity stops
    // to detect when the page is restored from bfcache
    if (!bound) {
        try {
            window[api(Constant.AddEventListener)]("pageshow", measure(handler) as EventListener, { capture: false, passive: true });
            bound = true;
        } catch {
            /* do nothing */
        }
    }
}

function handler(evt: PageTransitionEvent): void {
    // The persisted property indicates if the page was loaded from bfcache
    if (evt && evt.persisted) {
        // Restart Clarity since it was stopped when the page entered bfcache
        clarity.start();
        internal.log(Code.BFCache, Severity.Info);
    }
}

export function stop(): void {
    // Intentionally don't remove the listener or reset 'bound' flag
    // We need the listener to persist to detect bfcache restoration
}
