import { Event } from "@clarity-types/data";
import { PointerType } from "@clarity-types/interaction";
import { queue } from "@src/data/upload";
import { metadata } from "@src/layout/target";

export default async function (
    time: number, targetNode: Node, x: number, y: number, id: number,
    isPrimary: boolean, pointerType: PointerType, pressure: number,
    width: number, height: number
): Promise<void> {
    let pointerTarget = metadata(targetNode, Event.PointerDown, null, false);
    if (pointerTarget.id > 0) {
        queue([
            time, Event.PointerDown, pointerTarget.id, x, y, id,
            "" + isPrimary, pointerType, pressure, width, height
        ]);
    }
}
