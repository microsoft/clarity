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
            docW: buffer.docW,
            docH: buffer.docH,
            scrW: buffer.scrW,
            scrH: buffer.scrH,
            srlX: buffer.srlX,
            srlY: buffer.srlY,
            ptrX: buffer.ptrX,
            ptrY: buffer.ptrY,
            tActivity: buffer.tActivity,
            tSrl: buffer.tSrl,
            tPtr: buffer.tPtr,
            moveX: buffer.moveX,
            moveY: buffer.moveY,
            tMove: buffer.tMove,
            downX: buffer.downX,
            downY: buffer.downY,
            tDown: buffer.tDown,
            upX: buffer.upX,
            upY: buffer.upY,
            tUp: buffer.tUp,
            ptrPrevX: buffer.ptrPrevX,
            ptrPrevY: buffer.ptrPrevY,
            tPtrPrev: buffer.tPtrPrev,
          }
        };
    }
    buffer = buffer ? buffer : {
        visible: BooleanFlag.True,
        docW: 0,
        docH: 0,
        scrW: 0,
        scrH: 0,
        srlX: 0,
        srlY: 0,
        ptrX: 0,
        ptrY: 0,
        tActivity: 0,
        tSrl: 0,
        tPtr: undefined,
        moveX: undefined,
        moveY: undefined,
        tMove: undefined,
        downX: undefined,
        downY: undefined,
        tDown: undefined,
        upX: undefined,
        upY: undefined,
        tUp: undefined,
        ptrPrevX: undefined,
        ptrPrevY: undefined,
        tPtrPrev: undefined,
    };
}

export function track(event: Event, x: number, y: number, time?: number): void {
    switch (event) {
        case Event.Document:
            buffer.docW = x;
            buffer.docH = y;
            break;
        case Event.Resize:
            buffer.scrW = x;
            buffer.scrH = y;
            break;
        case Event.Scroll:
            buffer.srlX = x;
            buffer.srlY = y;
            buffer.tSrl = time;
            break;
        case Event.MouseMove:
            buffer.moveX = x;
            buffer.moveY = y;
            buffer.tMove = time;
            buffer.ptrPrevX = buffer.ptrX;
            buffer.ptrPrevY = buffer.ptrY;
            buffer.tPtrPrev = buffer.tPtr;
            buffer.ptrX = x;
            buffer.ptrY = y;
            buffer.tPtr = time;
            break;
        case Event.MouseDown:
            buffer.downX = x;
            buffer.downY = y;
            buffer.tDown = time;
            buffer.ptrPrevX = buffer.ptrX;
            buffer.ptrPrevY = buffer.ptrY;
            buffer.tPtrPrev = buffer.tPtr;
            buffer.ptrX = x;
            buffer.ptrY = y;
            buffer.tPtr = time;
            break;
        case Event.MouseUp:
            buffer.upX = x;
            buffer.upY = y;
            buffer.tUp = time;
            buffer.ptrPrevX = buffer.ptrX;
            buffer.ptrPrevY = buffer.ptrY;
            buffer.tPtrPrev = buffer.tPtr;
            buffer.ptrX = x;
            buffer.ptrY = y;
            buffer.tPtr = time;
            break;
        default:
            buffer.ptrPrevX = buffer.ptrX;
            buffer.ptrPrevY = buffer.ptrY;
            buffer.tPtrPrev = buffer.tPtr;
            buffer.ptrX = x;
            buffer.ptrY = y;
            buffer.tPtr = time;
            break;
    }
    update = true;
}

export function activity(t: number): void {
    buffer.tActivity = t;
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
