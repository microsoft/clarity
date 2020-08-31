import { Event } from "@clarity-types/data";
import { SelectionData, Setting } from "@clarity-types/interaction";
import { bind } from "@src/core/event";
import { schedule } from "@src/core/task";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import encode from "./encode";

export let data: SelectionData = null;
let previous: Selection = null;
let timeout: number = null;

export function start(): void {
    reset();
}

export function observe(root: Node): void {
    bind(root, "selectstart", recompute.bind(this, root), true);
    bind(root, "selectionchange", recompute.bind(this, root), true);
}

function recompute(root: Node): void {
    let doc = root.nodeType === Node.DOCUMENT_NODE ? root as Document : document;
    let current = doc.getSelection();

    // Bail out if we don't have a valid selection
    if (current === null) { return; }

    // Bail out if we got a valid selection but not valid nodes
    // In Edge, selectionchange gets fired even on interactions like right clicks and
    // can result in null anchorNode and focusNode if there was no previous selection on page
    // Also, ignore any selections that start and end at the exact same point
    if ((current.anchorNode === null && current.focusNode === null) ||
        (current.anchorNode === current.focusNode && current.anchorOffset === current.focusOffset)) {
        return;
    }
    let startNode = data.start ? data.start : null;
    if (previous !== null && data.start !== null && startNode !== current.anchorNode) {
        clearTimeout(timeout);
        process(Event.Selection);
    }

    data = {
        start: current.anchorNode,
        startOffset: current.anchorOffset,
        end: current.focusNode,
        endOffset: current.focusOffset
    };
    previous = current;

    clearTimeout(timeout);
    timeout = setTimeout(process, Setting.LookAhead, Event.Selection);
}

function process(event: Event): void {
    schedule(encode.bind(this, event));
}

export function reset(): void {
    previous = null;
    data = { start: 0, startOffset: 0, end: 0, endOffset: 0 };
}

export function stop(): void {
    reset();
    clearTimeout(timeout);
}
