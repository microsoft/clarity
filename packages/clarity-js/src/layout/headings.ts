import { Constant as DataConstant, Dimension } from "@clarity-types/data";
import { Constant } from "@clarity-types/layout";
import config from "@src/core/config";
import * as dimension from "@src/data/dimension";
import * as dom from "@src/layout/dom";

const MaxHeadingCandidates = 10;
const MaxHeadings = 3;
const MaxHeadingLength = 60;
// Keep text with at least one non-bullet, non-whitespace character.
const HeadingContentPattern = /[^\u2022\s]/;
const IncompleteUnicodeEndingPattern = /[\uD800-\uDBFF]$/;

let headings: { id: number; tag: string; text: string; textIds: number[] }[] = null;
let textPieces: { [id: number]: string } = null;
let authorized = false;
let serializedHeadings: string = null;

export function start(): void {
    headings = [];
    textPieces = null;
    authorized = false;
    serializedHeadings = null;
}

export function stop(): void {
    headings = null;
    textPieces = null;
    serializedHeadings = null;
}

export function observe(element: HTMLElement, tag: string): void {
    // Masked and empty headings consume candidate slots, not output slots.
    if (headings === null || (config.lean && config.lite) || headings.length === MaxHeadingCandidates) {
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
        headings.push({ id: target.id, tag, text: null, textIds: null });
    }
}

export function prepare(): void {
    if (headings === null) { return; }
    textPieces = {};
    for (const heading of headings) {
        if (heading.text !== null) { continue; }
        heading.textIds = [];
        const pendingIds = [heading.id];
        while (pendingIds.length > 0) {
            const record = dom.getValue(pendingIds.pop());
            if (!record || !record.metadata.active) { continue; }
            if (record.data.tag === Constant.ShadowDomTag ||
                record.data.tag === Constant.PolyfillShadowDomTag || record.data.tag === Constant.IFrameTag) {
                continue;
            }
            if (record.data.tag === Constant.TextTag) {
                heading.textIds.push(record.id);
                textPieces[record.id] = null;
                continue;
            }
            // Reverse insertion preserves document order without reading node text.
            for (let i = record.children.length - 1; i >= 0; i--) {
                pendingIds.push(record.children[i]);
            }
        }
    }
}

export function captureText(id: number, text: string, lengthEncoded: boolean): void {
    if (textPieces === null || !(id in textPieces)) { return; }
    const lengthCode = lengthEncoded ? text.trim() : Constant.Empty;
    if (lengthCode.length > 0) {
        // Playback encodes masked text as a base-36 length, not readable content.
        const maskedLength = Math.min(parseInt(lengthCode, 36), MaxHeadingLength);
        text = text.replace(lengthCode, Array(maskedLength + 1).join(DataConstant.Mask));
    }
    textPieces[id] = text;
}

export function complete(): void {
    if (headings === null || textPieces === null) { return; }

    const selected: string[] = [];
    for (const heading of headings) {
        if (heading.text === null) {
            heading.text = collectText(heading.textIds);
        }
        if (heading.text !== null && HeadingContentPattern.test(heading.text)) {
            selected.push(`${heading.tag}:${heading.text}`);
            if (selected.length === MaxHeadings) { break; }
        }
    }
    for (const heading of headings) { heading.textIds = null; }
    textPieces = null;

    // Encode each heading as H1:Checkout; separate headings with newlines.
    serializedHeadings = selected.join("\n");
    publish();
}

function collectText(textIds: number[]): string {
    let text: string = Constant.Empty;
    for (const id of textIds) {
        const piece = textPieces[id];
        // Do not manufacture a partial heading if this pass did not encode its text.
        if (piece === null) { return null; }
        const normalizedText = (text + piece).replace(/\s+/g, " ").replace(/^ /, Constant.Empty);
        text = normalizedText.substring(0, MaxHeadingLength);
        if (text.length === MaxHeadingLength) { break; }
    }

    const prefix = text.trim();
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
