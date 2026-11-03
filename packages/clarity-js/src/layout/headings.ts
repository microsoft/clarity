import { Dimension } from "@clarity-types/data";
import { Constant } from "@clarity-types/layout";
import * as scrub from "@src/core/scrub";
import * as dimension from "@src/data/dimension";
import * as dom from "@src/layout/dom";

const MaxHeadings = 3;
const MaxHeadingLength = 60;
const MaxHeadingNodes = 10;
const MaxSourceLength = 1000;

export function request(): void {
    const selected: string[] = [];
    const candidates = document.querySelectorAll("h1,h2,h3");
    for (let i = 0; i < candidates.length && i < MaxHeadings; i++) {
        const target = dom.get(candidates[i]);
        if (target && target.metadata.active) {
            selected.push(`${target.data.tag}:${collectText(target.id)}`);
        }
    }

    // Encode each heading as H1:Checkout; separate headings with ~~.
    dimension.log(Dimension.PageHeadings, selected.join("~~"));
}

function collectText(headingId: number): string {
    const pendingIds = [headingId];
    let text: string = Constant.Empty;
    let visited = 0;

    while (pendingIds.length > 0 && text.length < MaxHeadingLength && visited < MaxHeadingNodes) {
        const record = dom.getValue(pendingIds.pop());
        visited++;
        if (!record || !record.metadata.active) { continue; }

        if (record.data.tag === Constant.TextTag) {
            const source = record.data.value.substring(0, MaxSourceLength);
            const scrubbedPiece = scrub.nodeText(source, record.metadata.privacy);
            text = (text + scrubbedPiece).substring(0, MaxHeadingLength);
            continue;
        }

        // Reverse insertion makes the stack visit children in document order.
        for (let i = Math.min(record.children.length, MaxHeadingNodes - visited) - 1; i >= 0; i--) {
            pendingIds.push(record.children[i]);
        }
    }

    return text;
}
