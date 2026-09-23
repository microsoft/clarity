import { Dimension } from "@clarity-types/data";
import * as dimension from "@src/data/dimension";

const MaxHeadings = 3;
const MaxHeadingLength = 30;
const whitespace = /\s+/g;

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

    const value = normalize(element.textContent);
    if (!value) {
        return;
    }

    let index = 0;
    while (index < headings.length && !isBefore(element, headings[index].element)) {
        index++;
    }

    if (index < MaxHeadings) {
        headings.splice(index, 0, { element, value });
        if (headings.length > MaxHeadings) {
            headings.pop();
        }
    }
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

function isBefore(element: HTMLElement, other: HTMLElement): boolean {
    // tslint:disable-next-line:no-bitwise
    return (element.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

function normalize(value: string): string {
    return value ? value.replace(whitespace, " ").trim().substring(0, MaxHeadingLength) : "";
}
