import { BooleanFlag, Constant, Event, Setting } from "@clarity-types/data";
import { BrowsingContext, ClickState, TextInfo } from "@clarity-types/interaction";
import { Box } from "@clarity-types/layout";
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
    bind(root, "contextmenu", handler.bind(this, Event.ContextMenu, root), true);
}

function handler(event: Event, root: Node, evt: MouseEvent): void {
    let frame = iframe(root);
    let d = frame && frame.contentDocument ? frame.contentDocument.documentElement : document.documentElement;
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

    let relativeCoords = computeRelativeCoordinates(t as Element, x, y, l);
    let eX = relativeCoords.eX;
    let eY = relativeCoords.eY;

    // Check for null values before processing this event
    if (x !== null && y !== null) {
        const textInfo = text(t);
        state.push({
            time: time(evt), event, data: {
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
                w: l ? l.w : 0,
                h: l ? l.h : 0,
                tag: getElementAttribute(t, "tagName").substring(0, Setting.ClickTag),
                class: getElementAttribute(t, "className").substring(0, Setting.ClickClass),
                id: getElementAttribute(t, "id").substring(0, Setting.ClickId),
            }
        });
        schedule(encode.bind(this, event));
    }
}

function link(node: Node): HTMLAnchorElement {
    while (node && node !== document) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            let element = node as HTMLElement;
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
        let t = element.textContent || String((element as HTMLInputElement).value || '') || (element as HTMLImageElement).alt;
        if (t) {
            // Replace multiple occurrence of space characters with a single white space
            // Also, trim any spaces at the beginning or at the end of string
            const trimmedText =  t.replace(/\s+/g, Constant.Space).trim();
            // Finally, send only first few characters as specified by the Setting
            output = trimmedText.substring(0, Setting.ClickText);
            isFullText = output.length === trimmedText.length;
        }
    }

    return { text: output, isFullText: isFullText ? BooleanFlag.True : BooleanFlag.False };
}

function reaction(element: Node): BooleanFlag {
    const tag = getElementAttribute(element, "tagName");
    if (UserInputTags.indexOf(tag) >= 0) {
        return BooleanFlag.False;
    }
    return BooleanFlag.True;
}

function getElementAttribute(element: Node, attribute: "tagName" | "className" | "id"): string {
    if (element.nodeType === Node.ELEMENT_NODE) {
        const attr = (element as HTMLElement)?.[attribute];
        const value = typeof attr === "string" ? attr?.toLowerCase() : "";
        return value;
    }
    return "";
}

function layout(element: Element): Box {
    let box: Box = null;
    let doc = element.ownerDocument || document;
    let de = doc.documentElement;
    let win = doc.defaultView || window;

    if (typeof element.getBoundingClientRect === "function") {
        // getBoundingClientRect returns rectangle relative positioning to viewport
        let rect = element.getBoundingClientRect();

        if (rect && rect.width > 0 && rect.height > 0) {
            // Add viewport's scroll position to rectangle to get position relative to document origin
            // Also: using Math.floor() instead of Math.round() because in Edge,
            // getBoundingClientRect returns partial pixel values (e.g. 162.5px) and Chrome already
            // floors the value (e.g. 162px). This keeps consistent behavior across browsers.
            let scrollLeft = "pageXOffset" in win ? win.pageXOffset : de.scrollLeft;
            let scrollTop = "pageYOffset" in win ? win.pageYOffset : de.scrollTop;

            box = {
                x: Math.floor(rect.left + scrollLeft),
                y: Math.floor(rect.top + scrollTop),
                w: Math.floor(rect.width),
                h: Math.floor(rect.height)
            };

            // If this element is inside an iframe, add the iframe's offset to get parent-page coordinates
            let frame = iframe(doc);
            if (frame) {
                let distance = offset(frame);
                box.x += Math.round(distance.x);
                box.y += Math.round(distance.y);
            }
        }
    }
    return box;
}

function computeRelativeCoordinates(element: Element, x: number, y: number, l: Box): { eX: number, eY: number } {
    if (!l) return { eX: 0, eY: 0 };

    let box = l;
    let el = element;

    let eX = Math.max(Math.floor(((x - box.x) / box.w) * Setting.ClickPrecision), 0);
    let eY = Math.max(Math.floor(((y - box.y) / box.h) * Setting.ClickPrecision), 0);

    // Walk up parent chain if coords exceed bounds (can happen with CSS-rendered text)
    // Cap iterations to prevent performance issues with deeply nested DOM
    let iterations = 0;
    while ((eX > Setting.ClickPrecision || eY > Setting.ClickPrecision) && el.parentElement && iterations < Setting.ClickParentTraversal) {
        el = el.parentElement;
        iterations++;
        box = layout(el);
        if (!box) continue;

        eX = Math.max(Math.floor(((x - box.x) / box.w) * Setting.ClickPrecision), 0);
        eY = Math.max(Math.floor(((y - box.y) / box.h) * Setting.ClickPrecision), 0);
    }

    return { eX, eY };
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
