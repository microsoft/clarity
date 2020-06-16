import { Event, BooleanFlag } from "@clarity-types/data";
import { BaselineData, BaselineState } from "@clarity-types/data";
import { time } from "@src/core/time";
import encode from "@src/data/encode";

export let state: BaselineState = null;
let buffer: BaselineData = null;
let update: boolean = false;

export function start(): void {
    update = false;
    reset();
}

export function reset(): void {
    // Baseline state holds the previous values - if it is updated in the current payload, reset the state to current value after sending the previous state
    state = update ? { time: time(), event: Event.Baseline, data: buffer } : state;
    buffer = buffer ? buffer : { visible: BooleanFlag.True, docWidth: 0, docHeight: 0, screenWidth: 0, screenHeight: 0, activityTime: 0 };
}

export function track(event: Event, width: number, height: number): void {
    switch (event) {
        case Event.Document:
            buffer.docWidth = width;
            buffer.docHeight = height;
            break;
        case Event.Resize:
            buffer.screenWidth = width;
            buffer.screenHeight = height;
            break;
    }
    update = true;
}

export function activity(time: number) {
    buffer.activityTime = time;
}

export function visibility(visible: string, time: number): void {
    buffer.visible = visible === "visible" ? BooleanFlag.True : BooleanFlag.False;
    if (!buffer.visible) { activity(time); }
    update = true;
}

export function compute(): void {
    if (update) { encode(Event.Baseline); }
}

export function end(): void {
    reset();
}
