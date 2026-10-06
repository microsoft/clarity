import { Privacy } from "@clarity-types/core";
import { Dimension } from "@clarity-types/data";
import * as scrub from "@src/core/scrub";
import * as dimension from "@src/data/dimension";
import * as dom from "@src/layout/dom";

const MaxHeadings = 3;
const MaxHeadingLength = 60;
const HeadingContentPattern = /[^\u2022\s]/;

let headings: { tag: string; text: string }[] = null;
let discoveryComplete = false;
let authorized = false;

export function start(): void {
    headings = [];
    discoveryComplete = false;
    authorized = false;
}

export function stop(): void {
    headings = null;
}

export function observe(element: HTMLElement, tag: string): void {
    if (headings === null || discoveryComplete || headings.length === MaxHeadings ||
        tag.length !== 2 || tag[0] !== "H" || tag[1] < "1" || tag[1] > "6" ||
        element.ownerDocument !== document || (element.getRootNode && element.getRootNode() !== document)) {
        return;
    }

    const target = dom.get(element);
    const privacy = target ? target.metadata.privacy : Privacy.Text;
    const text = element.textContent.replace(/\s+/g, " ").trim().substring(0, MaxHeadingLength);
    // Truncation must not leave half a surrogate pair in the upload string.
    const value = scrub.text(text, "click", privacy).substring(0, MaxHeadingLength).replace(/[\uD800-\uDBFF]$/, "");
    headings.push({ tag, text: value });
}

export function request(): void {
    authorized = true;
    if (discoveryComplete) { compute(); }
}

export function compute(): void {
    discoveryComplete = true;
    if (!authorized || headings === null) { return; }

    const values = headings.filter(heading => HeadingContentPattern.test(heading.text));
    if (values.length > 0) {
        dimension.log(Dimension.PageHeadings, values.map(heading => `${heading.tag}:${heading.text}`).join("\n"));
    }
    headings = null;
}
