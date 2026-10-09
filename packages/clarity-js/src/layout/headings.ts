import { Dimension } from "@clarity-types/data";
import { Constant } from "@clarity-types/layout";
import * as scrub from "@src/core/scrub";
import * as dimension from "@src/data/dimension";
import * as dom from "@src/layout/dom";

const MaxHeadingCandidates = 10;
const MaxHeadings = 3;
const MaxHeadingLength = 60;
// Keep text with at least one non-bullet, non-whitespace character.
const HeadingContentPattern = /[^\u2022\s]/;
const IncompleteUnicodeEndingPattern = /[\uD800-\uDBFF]$/;

let headings: { id: number; tag: string; text: string }[] = null;
let authorized = false;
let serializedHeadings: string = null;

export function start(): void {
    headings = [];
    authorized = false;
    serializedHeadings = null;
}

export function stop(): void {
    headings = null;
    serializedHeadings = null;
}

export function observe(element: HTMLElement, tag: string): void {
    // Masked and empty headings consume candidate slots, not output slots.
    if (headings === null || headings.length === MaxHeadingCandidates) {
        return;
    }

    // Only H1-H6 elements qualify.
    if (tag.length !== 2 || tag[0] !== "H" || tag[1] < "1" || tag[1] > "6") {
        return;
    }

    // Exclude iframe documents and shadow roots.
    if (element.ownerDocument !== document ||
        (element.getRootNode && element.getRootNode() !== document)) {
        return;
    }

    const target = dom.get(element);
    if (target && !headings.some(heading => heading.id === target.id)) {
        headings.push({ id: target.id, tag, text: null });
    }
}

export function complete(): void {
    if (headings === null) { return; }

    const selected: string[] = [];
    for (const heading of headings) {
        if (heading.text === null) {
            heading.text = collectText(heading.id);
        }
        if (HeadingContentPattern.test(heading.text)) {
            selected.push(`${heading.tag}:${heading.text}`);
            if (selected.length === MaxHeadings) { break; }
        }
    }

    // Encode each heading as H1:Checkout; separate headings with newlines.
    serializedHeadings = selected.join("\n");
    publish();
}

function collectText(headingId: number): string {
    const pendingIds = [headingId];
    let text: string = Constant.Empty;

    while (pendingIds.length > 0 && text.length < MaxHeadingLength) {
        const record = dom.getValue(pendingIds.pop());
        if (!record || !record.metadata.active) { continue; }

        if (record.data.tag === Constant.ShadowDomTag ||
            record.data.tag === Constant.PolyfillShadowDomTag || record.data.tag === Constant.IFrameTag) {
            continue;
        }

        if (record.data.tag === Constant.TextTag) {
            const scrubbedPiece = scrub.text(record.data.value, Constant.TextTag, record.metadata.privacy);
            const normalizedText = (text + scrubbedPiece).replace(/\s+/g, " ").replace(/^ /, Constant.Empty);
            text = normalizedText.substring(0, MaxHeadingLength);
            continue;
        }

        // Reverse insertion makes the stack visit children in document order.
        for (let i = record.children.length - 1; i >= 0; i--) {
            pendingIds.push(record.children[i]);
        }
    }

    const prefix = text.trim().substring(0, MaxHeadingLength);
    return prefix.replace(IncompleteUnicodeEndingPattern, Constant.Empty);
}

export function request(): void {
    authorized = true;
    publish();
}

function publish(): void {
    if (authorized && serializedHeadings !== null) {
        dimension.log(Dimension.PageHeadings, serializedHeadings);
    }
}
