import { Event } from "@clarity-types/data";
import { DocumentData } from "@clarity-types/layout";
import encode from "./encode";

export let data: DocumentData;

export function reset(): void {
    data = null;
}

export function start(): void {
    reset();
    compute();
}

export function compute(): void {
    let body = document.body;
    let d = document.documentElement;
    let bodyClientWidth = body ? body.clientWidth : null;
    let bodyScrollWidth = body ? body.scrollWidth : null;
    let bodyOffsetWidth = body ? body.offsetWidth : null;
    let documentClientWidth = d ? d.clientWidth : null;
    let documentScrollWidth = d ? d.scrollWidth : null;
    let documentOffsetWidth = d ? d.offsetWidth : null;
    let width = Math.max(bodyClientWidth, bodyScrollWidth, bodyOffsetWidth,
        documentClientWidth, documentScrollWidth, documentOffsetWidth);

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

export function end(): void {
    reset();
}
