import { Event } from "@clarity-types/data";
import { type InputData, type InputState, Setting } from "@clarity-types/interaction";
import { FunctionNames } from "@clarity-types/performance";
import { bind } from "@src/core/event";
import { schedule } from "@src/core/task";
import { time } from "@src/core/time";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import { get } from "@src/layout/dom";
import { target } from "@src/layout/target";
import encode from "./encode";

let timeout: number = null;
export let state: InputState[] = [];

export function start(): void {
    reset();
}

export function observe(root: Node): void {
    bind(root, "input", recompute, true);
}

function recompute(evt: UIEvent): void {
    recompute.dn = FunctionNames.InputRecompute;
    const input = target(evt) as HTMLInputElement;
    const value = get(input);
    if (input?.type && value) {
        let v = input.value;
        const t = input.type;
        switch (input.type) {
            case "radio":
            case "checkbox":
                v = input.checked ? "true" : "false";
                break;
        }

        const data: InputData = { target: input, value: v, type: t };

        // If last entry in the queue is for the same target node as the current one, remove it so we can later swap it with current data.
        if (state.length > 0 && state[state.length - 1].data.target === data.target) {
            state.pop();
        }

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
