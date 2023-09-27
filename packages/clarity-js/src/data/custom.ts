import { Constant, CustomData, Event } from "@clarity-types/data";
import * as core from "@src/core";
import encode from "./encode";

export let data: CustomData = null;

export function event(a: string, b: string): void {
    if (core.active() &&
        a &&
        typeof a === Constant.String &&
        a.length < 255
        ) {
            if (b && typeof b === Constant.String && b.length < 255) {
                data = { key: a, value: b};
            } else {
                data = { value: a }
            }
            encode(Event.Custom);
        
    }
}
