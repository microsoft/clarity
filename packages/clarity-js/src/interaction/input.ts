import { Event } from "@clarity-types/data";
import { InputData, InputState, Setting } from "@clarity-types/interaction";
import { bind } from "@src/core/event";
import { schedule } from "@src/core/task";
import { time } from "@src/core/time";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import { get } from "@src/layout/dom";
import encode from "./encode";
import { target } from "@src/layout/target";

let timeout: number = null;
export let state: InputState[] = [];

export function start(): void {
    reset();
}

export function observe(root: Node): void {
    bind(root, "input", recompute, true);
}

function recompute(evt: UIEvent): void {
    let input = target(evt) as HTMLInputElement;
    let value = get(input);
    if (input && input.type && value) {
        let v = input.value;
        switch (input.type) {
            case "radio":
            case "checkbox":
                v = input.checked ? "true" : "false";
                break;
        }

        let data: InputData = { target: input, value: v };

        // If last entry in the queue is for the same target node as the current one, remove it so we can later swap it with current data.
        if (state.length > 0 && (state[state.length - 1].data.target === data.target)) { state.pop(); }

        state.push({ time: time(evt), event: Event.Input, data });

        clearTimeout(timeout);
        timeout = setTimeout(process, Setting.InputLookAhead, Event.Input);
    }
}

function process(event: Event): void {
    schedule(encode.bind(this, event));
}

export function reset(): void {
    state = [];
}

export function stop(): void {
    clearTimeout(timeout);
    reset();
}