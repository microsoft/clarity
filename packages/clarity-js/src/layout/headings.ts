import { Privacy } from "@clarity-types/core";
import { Dimension } from "@clarity-types/data";
import * as scrub from "@src/core/scrub";
import * as dimension from "@src/data/dimension";
import * as dom from "@src/layout/dom";

const MaxHeadings = 3;
const MaxHeadingLength = 60;
// Keep text with at least one non-bullet, non-whitespace character.
const HeadingContentPattern = /[^\u2022\s]/;

let headings: { tag: string; text: string }[] = null;
let authorized = false;
let snapshot: string = null;

export function start(): void {
    headings = [];
    authorized = false;
    snapshot = null;
}

export function stop(): void {
    headings = null;
    snapshot = null;
}

export function observe(element: HTMLElement, tag: string): void {
    // Masked and empty headings also consume a slot.
    if (headings === null || headings.length === MaxHeadings) {
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
    const privacy = target ? target.metadata.privacy : Privacy.Text;

    // Collapse whitespace to single spaces, trim, then cap the captured prefix.
    const normalizedText = element.textContent.replace(/\s+/g, " ").trim().substring(0, MaxHeadingLength);
    const scrubbedText = scrub.text(normalizedText, "click", privacy).substring(0, MaxHeadingLength)
        // Discard an unfinished Unicode pair if truncation split a character.
        .replace(/[\uD800-\uDBFF]$/, "");

    headings.push({ tag, text: scrubbedText });
}

export function complete(): void {
    if (headings === null) { return; }

    // Encode each heading as H1:Checkout; separate headings with newlines.
    snapshot = headings.filter(heading => HeadingContentPattern.test(heading.text))
        .map(heading => `${heading.tag}:${heading.text}`).join("\n");
    publish();
}

export function request(): void {
    authorized = true;
    publish();
}

function publish(): void {
    if (authorized && snapshot !== null) {
        dimension.log(Dimension.PageHeadings, snapshot);
    }
}
