import { Event, ConsentData } from "@clarity-types/data";
import * as core from "@src/core";
import encode from "@src/data/encode";

export let data: ConsentData = null;

export function consent(value: boolean): void {
    if (core.active) {
        data = { source: 2, value: value.toString() };

        encode(Event.Consent);
    }
}

