import { Event } from "@clarity-types/data";
import { UnloadData } from "@clarity-types/interaction";
import * as clarity from "@src/clarity";
import { bind } from "@src/core/event";
import encode from "./encode";

export let data: UnloadData;

export function start(): void {
    bind(window, "pagehide", recompute);
}

function recompute(evt: UIEvent): void {
    data = { name: evt.type };
    encode(Event.Unload);
    clarity.stop();
}

export function reset(): void {
    data = null;
}

export function stop(): void {
    reset();
}
