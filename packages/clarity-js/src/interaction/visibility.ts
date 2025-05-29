import { Event } from "@clarity-types/data";
import type { VisibilityData } from "@clarity-types/interaction";
import { FunctionNames } from "@clarity-types/performance";
import { bind } from "@src/core/event";
import { time } from "@src/core/time";
import encode from "./encode";

export let data: VisibilityData;

export function start(): void {
    bind(document, "visibilitychange", recompute);
    recompute();
}

function recompute(evt: UIEvent = null): void {
    recompute.dn = FunctionNames.VisibilityRecompute;
    data = { visible: "visibilityState" in document ? document.visibilityState : "default" };
    encode(Event.Visibility, time(evt));
}

export function reset(): void {
    data = null;
}

export function stop(): void {
    reset();
}
