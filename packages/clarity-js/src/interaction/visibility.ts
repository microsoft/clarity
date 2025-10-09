import { BooleanFlag, Event } from "@clarity-types/data";
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
    if ("visibilityState" in document) {
        const visible = document.visibilityState === "visible" ? BooleanFlag.True : BooleanFlag.False;
        data = { visible };
        encode(Event.Visibility, time(evt));
    }
}

export function reset(): void {
    data = null;
}

export function stop(): void {
    reset();
}