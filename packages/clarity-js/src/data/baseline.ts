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
            activityTime: buffer.activityTime,
            scrollTime: buffer.scrollTime,
            pointerTime: buffer.pointerTime,
            moveX: buffer.moveX,
            moveY: buffer.moveY,
            moveTime: buffer.moveTime,
            downX: buffer.downX,
            downY: buffer.downY,
            downTime: buffer.downTime,
            upX: buffer.upX,
            upY: buffer.upY,
            upTime: buffer.upTime,
            pointerPrevX: buffer.pointerPrevX,
            pointerPrevY: buffer.pointerPrevY,
            pointerPrevTime: buffer.pointerPrevTime,
            modules: buffer.modules,
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
        activityTime: 0,
        scrollTime: 0,
        pointerTime: undefined,
        moveX: undefined,
        moveY: undefined,
        moveTime: undefined,
        downX: undefined,
        downY: undefined,
        downTime: undefined,
        upX: undefined,
        upY: undefined,
        upTime: undefined,
        pointerPrevX: undefined,
        pointerPrevY: undefined,
        pointerPrevTime: undefined,
        modules: null,
    };
}

export function track(event: Event, x: number, y: number, time?: number): void {
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
            buffer.scrollTime = time;
            break;
        case Event.MouseMove:
            buffer.moveX = x;
            buffer.moveY = y;
            buffer.moveTime = time;
            buffer.pointerPrevX = buffer.pointerX;
            buffer.pointerPrevY = buffer.pointerY;
            buffer.pointerPrevTime = buffer.pointerTime;
            buffer.pointerX = x;
            buffer.pointerY = y;
            buffer.pointerTime = time;
            break;
        case Event.MouseDown:
            buffer.downX = x;
            buffer.downY = y;
            buffer.downTime = time;
            buffer.pointerPrevX = buffer.pointerX;
            buffer.pointerPrevY = buffer.pointerY;
            buffer.pointerPrevTime = buffer.pointerTime;
            buffer.pointerX = x;
            buffer.pointerY = y;
            buffer.pointerTime = time;
            break;
        case Event.MouseUp:
            buffer.upX = x;
            buffer.upY = y;
            buffer.upTime = time;
            buffer.pointerPrevX = buffer.pointerX;
            buffer.pointerPrevY = buffer.pointerY;
            buffer.pointerPrevTime = buffer.pointerTime;
            buffer.pointerX = x;
            buffer.pointerY = y;
            buffer.pointerTime = time;
            break;
        default:
            buffer.pointerPrevX = buffer.pointerX;
            buffer.pointerPrevY = buffer.pointerY;
            buffer.pointerPrevTime = buffer.pointerTime;
            buffer.pointerX = x;
            buffer.pointerY = y;
            buffer.pointerTime = time;
            break;
    }
    update = true;
}

export function activity(t: number): void {
    buffer.activityTime = t;
}

export function visibility(t: number, visible: BooleanFlag): void {
    buffer.visible = visible;
    if (!buffer.visible) {
        activity(t);
    }
    update = true;
}

export function dynamic(modules: Set<number>): void {
    buffer.modules = Array.from(modules);
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
