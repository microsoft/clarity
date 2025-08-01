import { Event } from "@clarity-types/data";
import { VisibilityData } from "@clarity-types/interaction";
import { bind } from "@src/core/event";
import { time } from "@src/core/time";
import encode from "./encode";

export let data: VisibilityData;

export function start(): void {
    bind(document, "visibilitychange", recompute);
    recompute();
}

function recompute(evt: UIEvent = null): void {
    data = { visible: "visibilityState" in document ? document.visibilityState : "default" };
    encode(Event.Visibility, time(evt));
}

export function reset(): void {
    data = null;
}

export function stop(): void {
    reset();
}