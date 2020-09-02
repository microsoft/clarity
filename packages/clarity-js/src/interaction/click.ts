import { Event } from "@clarity-types/data";
import { ClickState } from "@clarity-types/interaction";
import { bind } from "@src/core/event";
import { schedule } from "@src/core/task";
import { time } from "@src/core/time";
import { iframe } from "@src/layout/dom";
import offset from "@src/layout/offset";
import { layout } from "@src/layout/region";
import { link, target } from "@src/layout/target";
import encode from "./encode";

export let state: ClickState[] = [];
let clickPrecision = Math.pow(2, 15) - 1;

export function start(): void {
    reset();
}

export function observe(root: Node): void {
    bind(root, "click", handler.bind(this, Event.Click, root), true);
}

function handler(event: Event, root: Node, evt: MouseEvent): void {
    let frame = iframe(root);
    let d = frame ? frame.contentDocument.documentElement : document.documentElement;
    let x = "pageX" in evt ? Math.round(evt.pageX) : ("clientX" in evt ? Math.round(evt["clientX"] + d.scrollLeft) : null);
    let y = "pageY" in evt ? Math.round(evt.pageY) : ("clientY" in evt ? Math.round(evt["clientY"] + d.scrollTop) : null);
    // In case of iframe, we adjust (x,y) to be relative to top parent's origin
    if (frame) {
        let distance = offset(frame);
        x = x ? x + distance.x : x;
        y = y ? y + distance.y : y;
    }

    let t = target(evt);
    // Find nearest anchor tag (<a/>) parent if current target node is part of one
    // If present, we use the returned link element to populate text and link properties below
    let a = link(t);

    // Get layout rectangle for the target element
    let l = layout(t as Element);

    // Reference: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/detail
    // This property helps differentiate between a keyboard navigation vs. pointer click
    // In case of a keyboard navigation, we use center of target element as (x,y)
    if (evt.detail === 0 && l) {
        x = l.x + (l.w / 2);
        y = l.y + (l.h / 2);
    }

    let eX = l ? Math.max(Math.floor(((x - l.x) / l.w) * clickPrecision), 0) : 0;
    let eY = l ? Math.max(Math.floor(((y - l.y) / l.h) * clickPrecision), 0) : 0;

    // Check for null values before processing this event
    if (x !== null && y !== null) {
        state.push({
            time: time(), event, data: {
                target: t,
                x,
                y,
                eX,
                eY,
                button: evt.button,
                text: a ? a.textContent : null,
                link: a ? a.href : null,
                hash: null,
            }
        });
        schedule(encode.bind(this, event));
    }
}

export function reset(): void {
    state = [];
}

export function stop(): void {
    reset();
}
