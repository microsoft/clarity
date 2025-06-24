import { Constant, Dimension, Event } from "@clarity-types/data";
import { type ScrollState, Setting } from "@clarity-types/interaction";
import { FunctionNames } from "@clarity-types/performance";
import { bind } from "@src/core/event";
import { schedule } from "@src/core/task";
import { time } from "@src/core/time";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import * as dimension from "@src/data/dimension";
import { iframe } from "@src/layout/dom";
import { metadata, target } from "@src/layout/target";
import encode from "./encode";

export let state: ScrollState[] = [];
let initialTop: Node = null;
let initialBottom: Node = null;
let timeout: number = null;

export function start(): void {
    state = [];
    recompute();
}

export function observe(root: Node): void {
    const frame = iframe(root);
    const node = frame ? frame.contentWindow : root === document ? window : root;
    bind(node, "scroll", recompute, true);
}

function recompute(event: UIEvent = null): void {
    recompute.dn = FunctionNames.ScrollRecompute;
    let w = window as Window;
    let de = document.documentElement;
    let element = event ? target(event) : de;

    // If the target is a Document node, then identify corresponding documentElement and window for this document
    if (element && element.nodeType === Node.DOCUMENT_NODE) {
        const frame = iframe(element);
        w = frame ? frame.contentWindow : w;
        element = de = (element as Document).documentElement;
    }

    // Edge doesn't support scrollTop position on document.documentElement.
    // For cross browser compatibility, looking up pageYOffset on window if the scroll is on document.
    // And, if for some reason that is not available, fall back to looking up scrollTop on document.documentElement.
    const x = element === de && "pageXOffset" in w ? Math.round(w.pageXOffset) : Math.round((element as HTMLElement).scrollLeft);
    const y = element === de && "pageYOffset" in w ? Math.round(w.pageYOffset) : Math.round((element as HTMLElement).scrollTop);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const xPosition = width / 3;
    const yOffset = width > height ? height * 0.15 : height * 0.2;
    const startYPosition = yOffset;
    const endYPosition = height - yOffset;
    const top = getPositionNode(xPosition, startYPosition);
    const bottom = getPositionNode(xPosition, endYPosition);

    const current: ScrollState = { time: time(event), event: Event.Scroll, data: { target: element, x, y, top, bottom } };

    // We don't send any scroll events if this is the first event and the current position is top (0,0)
    if ((event === null && x === 0 && y === 0) || x === null || y === null) {
        initialTop = top;
        initialBottom = bottom;
        return;
    }

    const length = state.length;
    const last = length > 1 ? state[length - 2] : null;
    if (last && similar(last, current)) {
        state.pop();
    }
    state.push(current);

    clearTimeout(timeout);
    timeout = setTimeout(process, Setting.LookAhead, Event.Scroll);
}

function getPositionNode(x: number, y: number): Node {
    let node: Node;
    if ("caretPositionFromPoint" in document) {
        // biome-ignore lint/suspicious/noExplicitAny: caretPositionFromPoint is not defined on all browsers, makes typescript unhappy
        node = (document as any).caretPositionFromPoint(x, y)?.offsetNode;
    } else if ("caretRangeFromPoint" in document) {
        node = (document as Document).caretRangeFromPoint(x, y)?.startContainer;
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
    initialTop = null;
    initialBottom = null;
}

function process(event: Event): void {
    schedule(encode.bind(this, event));
}

function similar(last: ScrollState, current: ScrollState): boolean {
    const dx = last.data.x - current.data.x;
    const dy = last.data.y - current.data.y;
    return dx * dx + dy * dy < Setting.Distance * Setting.Distance && current.time - last.time < Setting.Interval;
}

export function compute(): void {
    compute.dn = FunctionNames.ScrollCompute;
    if (initialTop) {
        const top = metadata(initialTop, null);
        dimension.log(Dimension.InitialScrollTop, top?.hash?.join(Constant.Dot));
    }
    if (initialBottom) {
        const bottom = metadata(initialBottom, null);
        dimension.log(Dimension.InitialScrollBottom, bottom?.hash?.join(Constant.Dot));
    }
}

export function stop(): void {
    clearTimeout(timeout);
    state = [];
    initialTop = null;
    initialBottom = null;
}
