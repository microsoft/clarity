import { PointerType } from "@clarity-types/interaction";

export default function (
    _time: number,
    _pointerType: PointerType,
    _pressure: number,
    _width: number,
    _height: number
): Promise<void> {
    return Promise.resolve();
}
