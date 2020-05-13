import { OffsetDistance } from "@clarity-types/core";
import { iframe } from "@src/layout/dom";

export default function(element: HTMLElement): OffsetDistance {
    let output: OffsetDistance = { x: 0, y: 0 };

    // Walk up the chain to ensure we compute offset distance correctly
    // In case where we may have nested IFRAMEs, we keep walking up until we get to the top most parent page
    if (element && element.offsetParent) {
        do {
            let parent = element.offsetParent as HTMLElement;
            let frame = parent === null ? iframe(element.ownerDocument) : null;
            output.x += element.offsetLeft;
            output.y += element.offsetTop;
            element = frame ? frame : parent;
        } while (element);
    }
    return output;
}
