import { Event, TargetInfo } from "@clarity-types/data";
import { InputData, InputState } from "@clarity-types/interaction";
import config from "@src/core/config";
import { bind } from "@src/core/event";
import mask from "@src/core/mask";
import { schedule } from "@src/core/task";
import { time } from "@src/core/time";
import { target, track } from "@src/data/target";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import { get } from "@src/layout/dom";
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
    let input = target(evt) as HTMLInputElement;
    let value = get(input);
    if (input && input.type && value) {
        let v;
        switch (input.type) {
            case "radio":
            case "checkbox":
                v = input.checked ? "true" : "false";
                break;
            case "range":
                v = input.value;
                break;
            default:
                v = value.metadata.masked ? mask(input.value) : input.value;
                break;
        }

        let data: InputData = { target: track(input as Node), value: v };

        // If last entry in the queue is for the same target node as the current one, remove it so we can later swap it with current data.
        if (state.length > 0 && (state[state.length - 1].data.target as TargetInfo).id === (data.target as TargetInfo).id) { state.pop(); }

        state.push({ time: time(), event: Event.Input, data });

        clearTimeout(timeout);
        timeout = setTimeout(process, config.lookahead, Event.Input);
    }
}

function process(event: Event): void {
    schedule(encode.bind(this, event));
}

export function reset(): void {
    state = [];
}

export function end(): void {
    clearTimeout(timeout);
    reset();
}