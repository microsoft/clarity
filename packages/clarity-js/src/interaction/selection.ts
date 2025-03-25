import { Event } from "@clarity-types/data";
import { SelectionData, Setting } from "@clarity-types/interaction";
import { FunctionNames } from "@clarity-types/performance";
import { time } from "@src/core/time";
import * as summary from "@src/data/summary";
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
    trackDropdownChanges(root)
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
recompute.dn = FunctionNames.SelectionRecompute;

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

function trackDropdownChanges(root: Node): void {
    let queryableRoot = root as Document | Element;

    if (queryableRoot.querySelectorAll) {
        const dropdowns = queryableRoot.querySelectorAll("select");

        dropdowns.forEach(dropdown => {
            const selectElement = dropdown as HTMLSelectElement;
            bind(selectElement, "click", () => summary.track(Event.Change, time()), true);
            bind(selectElement, "change", () => summary.track(Event.Change, time()), true);
        });
    }
    summary.track(Event.Change, time());
}

