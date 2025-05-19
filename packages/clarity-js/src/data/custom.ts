import { type CustomData, Event } from "@clarity-types/data";
import * as core from "@src/core";
import encode from "./encode";

export let data: CustomData = null;

// custom events allow 2 parameters or 1 parameter to be passed. If 2 are passed we
// consider it a key value pair. If only 1 is passed we only consider the event to have a value.
export function event(a: string, b: string): void {
    if (core.active() && a && typeof a === "string" && a.length < 255) {
        if (b && typeof b === "string" && b.length < 255) {
            data = { key: a, value: b };
        } else {
            data = { value: a };
        }
        encode(Event.Custom);
    }
}
