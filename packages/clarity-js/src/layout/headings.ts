import { Privacy } from "@clarity-types/core";
import { Dimension } from "@clarity-types/data";
import * as scrub from "@src/core/scrub";
import * as dimension from "@src/data/dimension";
import * as dom from "@src/layout/dom";

const MaxHeadings = 3;
const MaxHeadingLength = 30;

export function compute(): void {
    const headings: { tag: string; text: string }[] = [];
    const queue: Element[] = [document.documentElement];
    while (queue.length > 0 && headings.length < MaxHeadings) {
        const element = queue.shift();
        for (let child = element.firstElementChild; child; child = child.nextElementSibling) { queue.push(child); }
        const tag = element.tagName;
        if (tag.length === 2 && tag.charCodeAt(0) === 72 && tag.charCodeAt(1) >= 49 && tag.charCodeAt(1) <= 54) {
            const target = dom.get(element);
            const privacy = target ? target.metadata.privacy : Privacy.Text;
            const text = element.textContent.replace(/\s+/g, " ").trim().substring(0, MaxHeadingLength);
            headings.push({ tag, text: scrub.text(text, "click", privacy).substring(0, MaxHeadingLength) });
        }
    }

    const values = headings.filter(heading => heading.text.length > 0);
    if (values.length > 0) {
        dimension.log(Dimension.PageHeadings, JSON.stringify(values));
    }
}
