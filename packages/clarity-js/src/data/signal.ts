import { SignalCallback } from "@clarity-types/data";

export let signalCallback: SignalCallback = null;

export function signal(cb: SignalCallback): void {
    signalCallback = cb
}

  