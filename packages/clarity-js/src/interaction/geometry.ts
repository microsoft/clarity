import { Event } from "@clarity-types/data";
import { PointerType } from "@clarity-types/interaction";
import { queue } from "@src/data/upload";

export default async function (time: number, pointerType: PointerType, pressure: number, width: number, height: number): Promise<void> {
    queue([time, Event.PointerGeometry, pointerType, pressure, width, height]);
}
