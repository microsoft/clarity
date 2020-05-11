import { OffsetDistance } from "@clarity-types/core";

export default function(element: HTMLElement): OffsetDistance {
    let output: OffsetDistance = { x: 0, y: 0 };
    if (element && element.offsetParent) {
        do {
            output.x += element.offsetLeft;
            output.y += element.offsetTop;
            element = element.offsetParent as HTMLElement;
        } while (element);
    }
    return output;
}
