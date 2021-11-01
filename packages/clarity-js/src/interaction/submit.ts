import { Event } from "@clarity-types/data";
import { SubmitState } from "@clarity-types/interaction";
import { bind } from "@src/core/event";
import { schedule } from "@src/core/task";
import { time } from "@src/core/time";
import encode from "./encode";
import { target } from "@src/layout/target";

export let state: SubmitState[] = [];

export function start(): void {
    reset();
}

export function observe(root: Node): void {
    bind(root, "submit", recompute, true);
}

function recompute(evt: UIEvent): void {
    state.push({ time: time(), event: Event.Submit, data: { target: target(evt) } });
    schedule(encode.bind(this, Event.Submit));
}

export function reset(): void {
    state = [];
}

export function stop(): void {
    reset();
}
