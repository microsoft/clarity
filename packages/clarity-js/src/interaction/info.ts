import { Event } from "@clarity-types/data";
import { PointerType } from "@clarity-types/interaction";
import { queue } from "@src/data/upload";

export default async function (time: number, pointerType: PointerType, x: number, y: number, pressure: number, width: number, height: number): Promise<void> {
    queue([time, Event.PointerInfo, pointerType, x, y, pressure, width, height]);
}
