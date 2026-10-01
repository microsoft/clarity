import { Privacy } from "@clarity-types/core";
import { Dimension } from "@clarity-types/data";
import * as scrub from "@src/core/scrub";
import * as dimension from "@src/data/dimension";
import * as dom from "@src/layout/dom";

const MaxHeadings = 3;
const MaxHeadingLength = 30;

let headings: { tag: string; text: string }[] = null;
let ready = false;
let requested = false;

export function start(): void {
    headings = [];
    ready = false;
    requested = false;
}

export function stop(): void {
    headings = null;
}

export function observe(element: HTMLElement, tag: string): void {
    if (headings === null || ready || headings.length === MaxHeadings ||
        tag.length !== 2 || tag.charCodeAt(0) !== 72 || tag.charCodeAt(1) < 49 || tag.charCodeAt(1) > 54 ||
        element.ownerDocument !== document || (element.getRootNode && element.getRootNode() !== document)) {
        return;
    }

    const target = dom.get(element);
    const privacy = target ? target.metadata.privacy : Privacy.Text;
    const text = element.textContent.replace(/\s+/g, " ").trim().substring(0, MaxHeadingLength);
    headings.push({ tag, text: scrub.text(text, "click", privacy).substring(0, MaxHeadingLength) });
}

export function request(): void {
    requested = true;
    if (ready) { compute(); }
}

export function compute(): void {
    ready = true;
    if (requested && headings !== null) {
        const values = headings.filter(heading => heading.text.length > 0);
        if (values.length > 0) {
            dimension.log(Dimension.PageHeadings, JSON.stringify(values));
        }
        headings = null;
    }
}
