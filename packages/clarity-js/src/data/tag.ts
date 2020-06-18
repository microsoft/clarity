import { Constant, Event, TagData } from "@clarity-types/data";
import encode from "@src/data/encode";

export let data: TagData = null;

export function reset(): void {
    data = null;
}

export function tag(name: string): void {
    if (name && typeof name === Constant.STRING_TYPE && name.length < 255) {
        data = { tag: name };
        encode(Event.Tag);
    }
}
