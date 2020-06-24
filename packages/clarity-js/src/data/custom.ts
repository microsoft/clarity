import { Constant, CustomData, Event } from "@clarity-types/data";
import encode from "./encode";

export let data: CustomData = null;

export function event(key: string, value: string): void {
    if (key &&
        value &&
        typeof key === Constant.STRING_TYPE &&
        typeof value === Constant.STRING_TYPE &&
        key.length < 255 &&
        value.length < 255) {
        data = { key, value};
        encode(Event.Custom);
    }
}
