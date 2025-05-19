import { BooleanFlag, Event } from "@clarity-types/data";
import type { UnloadData } from "@clarity-types/interaction";
import { FunctionNames } from "@clarity-types/performance";
import * as clarity from "@src/clarity";
import { bind } from "@src/core/event";
import { time } from "@src/core/time";
import encode from "./encode";

export let data: UnloadData;

export function start(): void {
    bind(window, "pagehide", recompute);
}

function recompute(evt: PageTransitionEvent): void {
    recompute.dn = FunctionNames.UnloadRecompute;
    data = { name: evt.type, persisted: evt.persisted ? BooleanFlag.True : BooleanFlag.False };
    encode(Event.Unload, time(evt));
    clarity.stop();
}

export function reset(): void {
    data = null;
}

export function stop(): void {
    reset();
}
