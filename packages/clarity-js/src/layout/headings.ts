import { Privacy } from "@clarity-types/core";
import { Dimension } from "@clarity-types/data";
import * as scrub from "@src/core/scrub";
import * as dimension from "@src/data/dimension";
import * as dom from "@src/layout/dom";

const MaxHeadings = 3;
const MaxHeadingLength = 30;

interface Heading {
    element: HTMLElement;
    tag: string;
    text: string;
}

let headings: Heading[] = null;

export function start(): void {
    headings = [];
}

export function stop(): void {
    headings = null;
}

export function observe(element: HTMLElement, tag: string): void {
    if (headings === null || !isHeading(tag) || element.ownerDocument !== document ||
        (element.getRootNode && element.getRootNode() !== document)) {
        return;
    }

    let index = 0;
    while (index < headings.length) {
        // tslint:disable-next-line:no-bitwise
        if (element.compareDocumentPosition(headings[index].element) & Node.DOCUMENT_POSITION_FOLLOWING) { break; }
        index++;
    }
    if (index >= MaxHeadings) { return; }

    const target = dom.get(element);
    const privacy = target ? target.metadata.privacy : Privacy.Text;
    if (privacy !== Privacy.None && privacy !== Privacy.Sensitive) { return; }

    const text = element.textContent.replace(/\s+/g, " ").trim().substring(0, MaxHeadingLength);
    if (!text || scrub.text(text, "click", privacy) !== text) { return; }

    headings.splice(index, 0, { element, tag, text });
    if (headings.length > MaxHeadings) { headings.pop(); }
}

export function compute(): void {
    if (headings === null) { return; }
    if (headings.length > 0) {
        const values = headings.map(({ tag, text }: Heading): { tag: string; text: string } => ({ tag, text }));
        dimension.log(Dimension.PageHeadings, JSON.stringify(values));
    }
    headings = null;
}

function isHeading(tag: string): boolean {
    return tag.length === 2 && tag.charCodeAt(0) === 72 && tag.charCodeAt(1) >= 49 && tag.charCodeAt(1) <= 54;
}
