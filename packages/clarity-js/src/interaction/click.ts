import { BooleanFlag, Constant, Event, Setting } from "@clarity-types/data";
import { BrowsingContext, type ClickState, type TextInfo } from "@clarity-types/interaction";
import type { Box } from "@clarity-types/layout";
import { FunctionNames } from "@clarity-types/performance";
import { bind } from "@src/core/event";
import { schedule } from "@src/core/task";
import { time } from "@src/core/time";
import { iframe } from "@src/layout/dom";
import { offset } from "@src/layout/offset";
import { target } from "@src/layout/target";
import encode from "./encode";

const UserInputTags = ["input", "textarea", "radio", "button", "canvas", "select"];
export let state: ClickState[] = [];

export function start(): void {
    reset();
}

export function observe(root: Node): void {
    bind(root, "click", handler.bind(this, Event.Click, root), true);
}

function handler(event: Event, root: Node, evt: MouseEvent): void {
    handler.dn = FunctionNames.ClickHandler;
    const frame = iframe(root);
    const d = frame ? frame.contentDocument.documentElement : document.documentElement;
    let x = "pageX" in evt ? Math.round(evt.pageX) : "clientX" in evt ? Math.round((evt as MouseEvent).clientX + d.scrollLeft) : null;
    let y = "pageY" in evt ? Math.round(evt.pageY) : "clientY" in evt ? Math.round((evt as MouseEvent).clientY + d.scrollTop) : null;
    // In case of iframe, we adjust (x,y) to be relative to top parent's origin
    if (frame) {
        const distance = offset(frame);
        x = x ? x + Math.round(distance.x) : x;
        y = y ? y + Math.round(distance.y) : y;
    }

    const t = target(evt);
    // Find nearest anchor tag (<a/>) parent if current target node is part of one
    // If present, we use the returned link element to populate text and link properties below
    const a = link(t);

    // Get layout rectangle for the target element
    const l = layout(t as Element);

    // Reference: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/detail
    // This property helps differentiate between a keyboard navigation vs. pointer click
    // In case of a keyboard navigation, we use center of target element as (x,y)
    if (evt.detail === 0 && l) {
        x = Math.round(l.x + l.w / 2);
        y = Math.round(l.y + l.h / 2);
    }

    const eX = l ? Math.max(Math.floor(((x - l.x) / l.w) * Setting.ClickPrecision), 0) : 0;
    const eY = l ? Math.max(Math.floor(((y - l.y) / l.h) * Setting.ClickPrecision), 0) : 0;

    // Check for null values before processing this event
    if (x !== null && y !== null) {
        const textInfo = text(t);
        state.push({
            time: time(evt),
            event,
            data: {
                target: t,
                x,
                y,
                eX,
                eY,
                button: evt.button,
                reaction: reaction(t),
                context: context(a),
                text: textInfo.text,
                link: a ? a.href : null,
                hash: null,
                trust: evt.isTrusted ? BooleanFlag.True : BooleanFlag.False,
                isFullText: textInfo.isFullText,
            },
        });
        schedule(encode.bind(this, event));
    }
}

function link(inputNode: Node): HTMLAnchorElement {
    let node = inputNode;
    while (node && node !== document) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            if (element.tagName === "A") {
                return element as HTMLAnchorElement;
            }
        }
        node = node.parentNode;
    }
    return null;
}

function text(element: Node): TextInfo {
    let output = null;
    let isFullText = false;
    if (element) {
        // Grab text using "textContent" for most HTMLElements, however, use "value" for HTMLInputElements and "alt" for HTMLImageElement.
        const t = element.textContent || String((element as HTMLInputElement).value || "") || (element as HTMLImageElement).alt;
        if (t) {
            // Replace multiple occurrence of space characters with a single white space
            // Also, trim any spaces at the beginning or at the end of string
            const trimmedText = t.replace(/\s+/g, Constant.Space).trim();
            // Finally, send only first few characters as specified by the Setting
            output = trimmedText.substring(0, Setting.ClickText);
            isFullText = output.length === trimmedText.length;
        }
    }

    return { text: output, isFullText: isFullText ? BooleanFlag.True : BooleanFlag.False };
}

function reaction(element: Node): BooleanFlag {
    if (element.nodeType === Node.ELEMENT_NODE) {
        const tag = (element as HTMLElement).tagName.toLowerCase();
        if (UserInputTags.indexOf(tag) >= 0) {
            return BooleanFlag.False;
        }
    }
    return BooleanFlag.True;
}

function layout(element: Element): Box {
    let box: Box = null;
    const de = document.documentElement;
    if (typeof element.getBoundingClientRect === "function") {
        // getBoundingClientRect returns rectangle relative positioning to viewport
        const rect = element.getBoundingClientRect();

        if (rect && rect.width > 0 && rect.height > 0) {
            // Add viewport's scroll position to rectangle to get position relative to document origin
            // Also: using Math.floor() instead of Math.round() because in Edge,
            // getBoundingClientRect returns partial pixel values (e.g. 162.5px) and Chrome already
            // floors the value (e.g. 162px). This keeps consistent behavior across browsers.
            box = {
                x: Math.floor(rect.left + ("pageXOffset" in window ? window.pageXOffset : de.scrollLeft)),
                y: Math.floor(rect.top + ("pageYOffset" in window ? window.pageYOffset : de.scrollTop)),
                w: Math.floor(rect.width),
                h: Math.floor(rect.height),
            };
        }
    }
    return box;
}

function context(a: HTMLAnchorElement): BrowsingContext {
    if (a?.hasAttribute(Constant.Target)) {
        switch (a.getAttribute(Constant.Target)) {
            case Constant.Blank:
                return BrowsingContext.Blank;
            case Constant.Parent:
                return BrowsingContext.Parent;
            case Constant.Top:
                return BrowsingContext.Top;
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
