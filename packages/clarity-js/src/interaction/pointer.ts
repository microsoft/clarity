import { Event } from "@clarity-types/data";
import { PointerState, Setting } from "@clarity-types/interaction";
import { bind } from "@src/core/event";
import { schedule } from "@src/core/task";
import { time } from "@src/core/time";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import { iframe } from "@src/layout/dom";
import { offset } from "@src/layout/offset";
import { target } from "@src/layout/target";
import encode from "./encode";

export let state: PointerState[] = [];
let timeout: number = null;
let activeTouchPointId = 0;
const activeTouchPointIds = new Set<number>();

export function start(): void {
    reset();
}

export function observe(root: Node): void {
    bind(root, "mousedown", mouse.bind(this, Event.MouseDown, root), true);
    bind(root, "mouseup", mouse.bind(this, Event.MouseUp, root), true);
    bind(root, "mousemove", mouse.bind(this, Event.MouseMove, root), true);
    bind(root, "wheel", mouse.bind(this, Event.MouseWheel, root), true);
    bind(root, "dblclick", mouse.bind(this, Event.DoubleClick, root), true);
    bind(root, "touchstart", touch.bind(this, Event.TouchStart, root), true);
    bind(root, "touchend", touch.bind(this, Event.TouchEnd, root), true);
    bind(root, "touchmove", touch.bind(this, Event.TouchMove, root), true);
    bind(root, "touchcancel", touch.bind(this, Event.TouchCancel, root), true);
}

function mouse(event: Event, root: Node, evt: MouseEvent): void {
    let frame = iframe(root);
    let d = frame ? frame.contentDocument.documentElement : document.documentElement;
    let x = "pageX" in evt ? Math.round(evt.pageX) : ("clientX" in evt ? Math.round(evt["clientX"] + d.scrollLeft) : null);
    let y = "pageY" in evt ? Math.round(evt.pageY) : ("clientY" in evt ? Math.round(evt["clientY"] + d.scrollTop) : null);
    // In case of iframe, we adjust (x,y) to be relative to top parent's origin
    if (frame) {
        let distance = offset(frame);
        x = x ? x + Math.round(distance.x) : x;
        y = y ? y + Math.round(distance.y) : y;
    }

    // Check for null values before processing this event
    if (x !== null && y !== null) { handler({ time: time(evt), event, data: { target: target(evt), x, y } }); }
}

function touch(event: Event, root: Node, evt: TouchEvent): void {
    let frame = iframe(root);
    let d = frame ? frame.contentDocument.documentElement : document.documentElement;
    let touches = evt.changedTouches;

    let t = time(evt);
    if (touches) {
        for (let i = 0; i < touches.length; i++) {
            let entry = touches[i];
            let x = "clientX" in entry ? Math.round(entry["clientX"] + d.scrollLeft) : null;
            let y = "clientY" in entry ? Math.round(entry["clientY"] + d.scrollTop) : null;
            x = x && frame ? x + Math.round(frame.offsetLeft) : x;
            y = y && frame ? y + Math.round(frame.offsetTop) : y;

            // We cannot rely on identifier to determine primary touch as its value doesn't always start with 0.
            // Safari/Webkit uses the address of the UITouch object as the identifier value for each touch point.
            const id = "identifier" in entry ? entry["identifier"] : undefined;

            switch(event) {
                case Event.TouchStart:
                    if (activeTouchPointIds.size === 0) {
                        activeTouchPointId = id;
                    }
                    activeTouchPointIds.add(id);
                    break;
                case Event.TouchEnd:
                case Event.TouchCancel:
                    activeTouchPointIds.delete(id);
                    break;
            }
            const isPrimary = activeTouchPointId === id;

            // Check for null values before processing this event
            if (x !== null && y !== null) { handler({ time: t, event, data: { target: target(evt), x, y, id, isPrimary } }); }
        }
    }
}

function handler(current: PointerState): void {
    switch (current.event) {
        case Event.MouseMove:
        case Event.MouseWheel:
        case Event.TouchMove:
            let length = state.length;
            let last = length > 1 ? state[length - 2] : null;
            if (last && similar(last, current)) { state.pop(); }
            state.push(current);

            clearTimeout(timeout);
            timeout = setTimeout(process, Setting.LookAhead, current.event);
            break;
        default:
            state.push(current);
            process(current.event);
            break;
    }
}

function process(event: Event): void {
    schedule(encode.bind(this, event));
}

export function reset(): void {
    state = [];
}

function similar(last: PointerState, current: PointerState): boolean {
    let dx = last.data.x - current.data.x;
    let dy = last.data.y - current.data.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    let gap = current.time - last.time;
    let match = current.data.target === last.data.target;
    return current.event === last.event && match && distance < Setting.Distance && gap < Setting.Interval;
}

export function stop(): void {
    clearTimeout(timeout);
    // Send out any pending pointer events in the pipeline
    if (state.length > 0) { process(state[state.length - 1].event); }
}
