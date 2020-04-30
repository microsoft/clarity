import { Event } from "@clarity-types/data";
import { UnloadData } from "@clarity-types/interaction";
import * as clarity from "@src/clarity";
import { bind } from "@src/core/event";
import encode from "./encode";

export let data: UnloadData;

export function start(): void {
    bind(window, "beforeunload", recompute);
    bind(window, "unload", recompute);
    bind(window, "pagehide", recompute);
}

function recompute(evt: UIEvent): void {
    data = { name: evt.type };
    encode(Event.Unload);
    clarity.end();
}

export function reset(): void {
    data = null;
}

export function end(): void {
    reset();
}
