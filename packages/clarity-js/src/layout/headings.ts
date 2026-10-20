import { Dimension } from "@clarity-types/data";
import { Constant } from "@clarity-types/layout";
import * as scrub from "@src/core/scrub";
import * as dimension from "@src/data/dimension";
import * as dom from "@src/layout/dom";

const MaxHeadings = 3;
const MaxHeadingLength = 60;
const MaxHeadingWork = 1000;

let active = false;
let authorized = false;
let serializedHeadings: string = null;

export function start(): void {
    active = true;
    authorized = false;
    serializedHeadings = null;
}

export function stop(): void {
    active = false;
    serializedHeadings = null;
}

export function complete(): void {
    if (!active || serializedHeadings !== null) { return; }

    const selected: string[] = [];
    let count = 0;
    const candidates = document.querySelectorAll("h1,h2,h3,h4,h5,h6");
    for (let i = 0; i < candidates.length && count < MaxHeadings; i++) {
        const target = dom.get(candidates[i]);
        if (target && target.metadata.active && target.data.tag === candidates[i].tagName) {
            count++;
            const text = collectText(target.id);
            if (text !== null) { selected.push(`${target.data.tag}:${text}`); }
        }
    }

    // Encode each heading as H1:Checkout; separate headings with newlines.
    serializedHeadings = selected.join("\n");
    publish();
}

function collectText(headingId: number): string | null {
    const pendingIds = [headingId];
    let text: string = Constant.Empty;
    let remaining = MaxHeadingWork - 1;

    while (pendingIds.length > 0 && text.length < MaxHeadingLength) {
        const record = dom.getValue(pendingIds.pop());
        if (!record || !record.metadata.active) { continue; }

        if (record.data.tag === Constant.ShadowDomTag ||
            record.data.tag === Constant.PolyfillShadowDomTag || record.data.tag === Constant.IFrameTag) {
            continue;
        }

        const isText = record.data.tag === Constant.TextTag;
        // Charge queued nodes and full source text before processing either.
        remaining -= isText ? record.data.value.length : record.children.length;
        if (remaining < 0) { return null; }

        if (isText) {
            const scrubbedPiece = scrub.text(record.data.value, Constant.TextTag, record.metadata.privacy);
            text = (text + scrubbedPiece).substring(0, MaxHeadingLength);
            continue;
        }

        // Reverse insertion makes the stack visit children in document order.
        for (let i = record.children.length - 1; i >= 0; i--) {
            pendingIds.push(record.children[i]);
        }
    }

    return text.replace(/\s+/g, " ").trim();
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
