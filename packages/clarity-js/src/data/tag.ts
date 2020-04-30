import { Event, TagData } from "@clarity-types/data";
import encode from "@src/data/encode";

export let data: TagData = null;

export function reset(): void {
    data = null;
}

export function tag(key: string, value: string | string[]): void {
    value = typeof value === "string" ? [value] : value;
    data = { key, value };
    encode(Event.Tag);
}
