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
    dimension.log(Dimension.PageHeadings, selected.join(Constant.Tilde + Constant.Tilde));
}

function collectText(headingId: number): string {
    let text: string = Constant.Empty;
    let visited = 0;

    function visit(id: number): boolean {
        visited++;
        const record = dom.getValue(id);
        const active = record && record.metadata.active;

        if (active && record.data.tag === Constant.TextTag) {
            const source = record.data.value.substring(0, MaxSourceLength);
            const scrubbedPiece = scrub.nodeText(source, record.metadata.privacy);
            text = (text + scrubbedPiece).substring(0, MaxHeadingLength);
        }

        if (visited >= MaxHeadingNodes || text.length >= MaxHeadingLength) { return true; }

        if (active) {
            for (const childId of record.children) {
                if (visit(childId)) { return true; }
            }
        }
        return false;
    }

    visit(headingId);
    return text;
}
