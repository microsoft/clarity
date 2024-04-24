import { Dimension, Event } from "@clarity-types/data";
import { ScrollState, Setting } from "@clarity-types/interaction";
import { bind } from "@src/core/event";
import { schedule } from "@src/core/task";
import { time } from "@src/core/time";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import { iframe } from "@src/layout/dom";
import { target, metadata } from "@src/layout/target";
import encode from "./encode";
import * as dimension from "@src/data/dimension";

export let state: ScrollState[] = [];
let initTopNode: Node;
let initBottomNode: Node;
let timeout: number = null;

export function start(): void {
    state = [];
    recompute();
}

export function observe(root: Node): void {
    let frame = iframe(root);
    let node = frame ? frame.contentWindow : (root === document ? window : root);
    bind(node, "scroll", recompute, true);
}

function recompute(event: UIEvent = null): void {
    let w = window as Window;
    let de = document.documentElement;
    let element = event ? target(event) : de;

    // If the target is a Document node, then identify corresponding documentElement and window for this document
    if (element && element.nodeType === Node.DOCUMENT_NODE) {
        let frame = iframe(element);
        w = frame ? frame.contentWindow : w;
        element = de = (element as Document).documentElement;
    }

    // Edge doesn't support scrollTop position on document.documentElement.
    // For cross browser compatibility, looking up pageYOffset on window if the scroll is on document.
    // And, if for some reason that is not available, fall back to looking up scrollTop on document.documentElement.
    let x = element === de && "pageXOffset" in w ? Math.round(w.pageXOffset) : Math.round((element as HTMLElement).scrollLeft);
    let y = element === de && "pageYOffset" in w ? Math.round(w.pageYOffset) : Math.round((element as HTMLElement).scrollTop);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const xPosition = width / 3;
    const yOffset = width > height ? height * 0.15 : height * 0.2;
    const startYPosition = yOffset;
    const endYPosition = height - yOffset;
    const top = getPositionNode(xPosition, startYPosition);
    const bottom = getPositionNode(xPosition, endYPosition);

    let current: ScrollState = { time: time(event), event: Event.Scroll, data: {target: element, x, y, top, bottom} };

    // We don't send any scroll events if this is the first event and the current position is top (0,0)
    if ((event === null && x === 0 && y === 0) || (x === null || y === null)) {
        initTopNode = top;
        initBottomNode = bottom;
        return;
    }

    let length = state.length;
    let last = length > 1 ? state[length - 2] : null;
    if (last && similar(last, current)) { state.pop(); }
    state.push(current);

    clearTimeout(timeout);
    timeout = setTimeout(process, Setting.LookAhead, Event.Scroll);
}

function getPositionNode(x: number, y: number): Node {
    let node: Node;
    if ("caretPositionFromPoint" in document) {
        node = (document as any).caretPositionFromPoint(x, y)?.offsetNode;
    } else if ("caretRangeFromPoint" in document) {
        node = document.caretRangeFromPoint(x, y)?.startContainer;
    }
    if (!node) {
        node = document.elementFromPoint(x, y) as Node;
    }
    if (node && node.nodeType === Node.TEXT_NODE) {
        node = node.parentNode;
    }

    return node;
}

export function reset(): void {
    state = [];
}

function process(event: Event): void {
    schedule(encode.bind(this, event));
}

function similar(last: ScrollState, current: ScrollState): boolean {
    let dx = last.data.x - current.data.x;
    let dy = last.data.y - current.data.y;
    return (dx * dx + dy * dy < Setting.Distance * Setting.Distance) && (current.time - last.time < Setting.Interval);
}

export function compute(): void {
    const sTopTarget = metadata(initTopNode, null);
    const sBottomTarget = metadata(initBottomNode, null);
    dimension.log(Dimension.InitialTop, sTopTarget?.hash?.[1]);
    dimension.log(Dimension.InitialBottom, sBottomTarget?.hash?.[1]);
}

export function stop(): void {
    clearTimeout(timeout);
    state = [];
}
