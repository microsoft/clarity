import type { OffsetDistance } from "@clarity-types/core";
import { iframe } from "@src/layout/dom";

export function offset(inputElement: HTMLElement): OffsetDistance {
    let element = inputElement;
    const output: OffsetDistance = { x: 0, y: 0 };

    // Walk up the chain to ensure we compute offset distance correctly
    // In case where we may have nested IFRAMEs, we keep walking up until we get to the top most parent page
    if (element?.offsetParent) {
        do {
            const parent = element.offsetParent as HTMLElement;
            const frame = parent === null ? iframe(element.ownerDocument) : null;
            output.x += element.offsetLeft;
            output.y += element.offsetTop;
            element = frame ? frame : parent;
        } while (element);
    }
    return output;
}
