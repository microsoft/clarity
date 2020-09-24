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
    // Baseline state holds the previous values - if it is updated in the current payload,
    // reset the state to current value after sending the previous state
    if (update) {
        state = { time: time(), event: Event.Baseline, data: {
            visible: buffer.visible,
            docWidth: buffer.docWidth,
            docHeight: buffer.docHeight,
            screenWidth: buffer.screenWidth,
            screenHeight: buffer.screenHeight,
            scrollX: buffer.scrollX,
            scrollY: buffer.scrollY,
            pointerX: buffer.pointerX,
            pointerY: buffer.pointerY,
            activityTime: buffer.activityTime
          }
        };
    }
    buffer = buffer ? buffer : {
        visible: BooleanFlag.True,
        docWidth: 0,
        docHeight: 0,
        screenWidth: 0,
        screenHeight: 0,
        scrollX: 0,
        scrollY: 0,
        pointerX: 0,
        pointerY: 0,
        activityTime: 0
    };
}

export function track(event: Event, x: number, y: number): void {
    switch (event) {
        case Event.Document:
            buffer.docWidth = x;
            buffer.docHeight = y;
            break;
        case Event.Resize:
            buffer.screenWidth = x;
            buffer.screenHeight = y;
            break;
        case Event.Scroll:
            buffer.scrollX = x;
            buffer.scrollY = y;
            break;
        default:
            buffer.pointerX = x;
            buffer.pointerY = y;
            break;
    }
    update = true;
}

export function activity(t: number): void {
    buffer.activityTime = t;
}

export function visibility(t: number, visible: string): void {
    buffer.visible = visible === "visible" ? BooleanFlag.True : BooleanFlag.False;
    if (!buffer.visible) {
        activity(t);
    }
    update = true;
}

export function compute(): void {
    if (update) {
        encode(Event.Baseline);
    }
}

export function stop(): void {
    reset();
}
