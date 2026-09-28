import { Privacy } from "@clarity-types/core";
import { Dimension } from "@clarity-types/data";
import * as scrub from "@src/core/scrub";
import { normalizeText } from "@src/core/text";
import * as dimension from "@src/data/dimension";
import * as dom from "@src/layout/dom";

const MaxHeadings = 3;
const MaxHeadingLength = 30;

interface Heading {
    element: HTMLElement;
    value: string;
}

let headings: Heading[] = [];

export function start(): void {
    headings = [];
}

export function stop(): void {
    headings = [];
}

export function observe(element: HTMLElement, tag: string): void {
    if (!isHeading(tag) || element.ownerDocument !== document ||
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

    const value = normalizeText(element.textContent || "").substring(0, MaxHeadingLength);
    if (!value || scrub.text(value, "click", privacy) !== value) { return; }

    headings.splice(index, 0, { element, value });
    if (headings.length > MaxHeadings) { headings.pop(); }
}

export function compute(): void {
    if (headings.length > 0) {
        dimension.log(Dimension.PageHeadings, JSON.stringify(headings.map((heading: Heading): string => heading.value)));
    }
    headings = [];
}

function isHeading(tag: string): boolean {
    return tag.length === 2 && tag.charCodeAt(0) === 72 && tag.charCodeAt(1) >= 49 && tag.charCodeAt(1) <= 54;
}
