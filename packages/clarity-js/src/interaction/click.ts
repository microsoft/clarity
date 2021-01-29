import { BooleanFlag, Constant, Event, Setting } from "@clarity-types/data";
import { BrowsingContext, ClickState } from "@clarity-types/interaction";
import { Box } from "@clarity-types/layout";
import { bind } from "@src/core/event";
import { schedule } from "@src/core/task";
import { time } from "@src/core/time";
import { iframe } from "@src/layout/dom";
import offset from "@src/layout/offset";
import { link, target } from "@src/layout/target";
import encode from "./encode";

const UserInputTags = ["input", "textarea", "radio", "button", "canvas"];
export let state: ClickState[] = [];

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
        x = x ? x + Math.round(distance.x) : x;
        y = y ? y + Math.round(distance.y) : y;
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
        x = Math.round(l.x + (l.w / 2));
        y = Math.round(l.y + (l.h / 2));
    }

    let eX = l ? Math.max(Math.floor(((x - l.x) / l.w) * Setting.ClickPrecision), 0) : 0;
    let eY = l ? Math.max(Math.floor(((y - l.y) / l.h) * Setting.ClickPrecision), 0) : 0;

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
                reaction: reaction(t),
                context: context(a),
                text: text(t),
                link: a ? a.href : null,
                hash: null
            }
        });
        schedule(encode.bind(this, event));
    }
}

function text(element: Node): string {
    let output = null;
    if (element) {
        // Grab text using "textContent" for most HTMLElements, however, use "value" for HTMLInputElements and "alt" for HTMLImageElement.
        let t = element.textContent || (element as HTMLInputElement).value || (element as HTMLImageElement).alt;
        if (t) {
            // Trim any spaces at the beginning or at the end of string
            // Also, replace multiple occurrence of space characters with a single white space
            // Finally, send only first few characters as specified by the Setting
            output = t.trim().replace(/\s+/g, Constant.Space).substr(0, Setting.ClickText);
        }
    }
    return output;
}

function reaction(element: Node): BooleanFlag {
    if (element.nodeType === Node.ELEMENT_NODE) {
        let tag = (element as HTMLElement).tagName.toLowerCase();
        if (UserInputTags.indexOf(tag) >= 0) {
            return BooleanFlag.False;
        }
    }
    return BooleanFlag.True;
}

function layout(element: Element): Box {
    let box: Box = null;
    let de = document.documentElement;
    if (typeof element.getBoundingClientRect === "function") {
        // getBoundingClientRect returns rectangle relative positioning to viewport
        let rect = element.getBoundingClientRect();

        if (rect && rect.width > 0 && rect.height > 0) {
            // Add viewport's scroll position to rectangle to get position relative to document origin
            // Also: using Math.floor() instead of Math.round() because in Edge,
            // getBoundingClientRect returns partial pixel values (e.g. 162.5px) and Chrome already
            // floors the value (e.g. 162px). This keeps consistent behavior across browsers.
            box = {
                x: Math.floor(rect.left + ("pageXOffset" in window ? window.pageXOffset : de.scrollLeft)),
                y: Math.floor(rect.top + ("pageYOffset" in window ? window.pageYOffset : de.scrollTop)),
                w: Math.floor(rect.width),
                h: Math.floor(rect.height)
            };
        }
    }
    return box;
}

function context(a: HTMLAnchorElement): BrowsingContext {
    if (a && a.hasAttribute(Constant.Target)) {
        switch (a.getAttribute(Constant.Target)) {
            case Constant.Blank: return BrowsingContext.Blank;
            case Constant.Parent: return BrowsingContext.Parent;
            case Constant.Top: return BrowsingContext.Top;
        }
    }
    return BrowsingContext.Self;
}

export function reset(): void {
    state = [];
}

export function stop(): void {
    reset();
}
