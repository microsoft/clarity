import { Event } from "@clarity-types/data";
import { DocumentData } from "@clarity-types/layout";
import encode from "@src/layout/encode";

export let data: DocumentData;

export function reset(): void {
    data = null;
}

export function compute(): void {
    let body = document.body;
    let d = document.documentElement;
    let width = body ? body.clientWidth : null;
    let bodyClientHeight = body ? body.clientHeight : null;
    let bodyScrollHeight = body ? body.scrollHeight : null;
    let bodyOffsetHeight = body ? body.offsetHeight : null;
    let documentClientHeight = d ? d.clientHeight : null;
    let documentScrollHeight = d ? d.scrollHeight : null;
    let documentOffsetHeight = d ? d.offsetHeight : null;
    let height = Math.max(bodyClientHeight, bodyScrollHeight, bodyOffsetHeight,
        documentClientHeight, documentScrollHeight, documentOffsetHeight);

    // Check that width or height has changed from before, and also that width & height are not null values
    if ((data === null || width !== data.width || height !== data.height) && width !== null && height !== null) {
        data = { width, height };
        encode(Event.Document);
    }
}
