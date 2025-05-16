import { Event } from "@clarity-types/data";
import type { DocumentData } from "@clarity-types/layout";
import { FunctionNames } from "@clarity-types/performance";
import encode from "@src/layout/encode";

export let data: DocumentData;

export function reset(): void {
    data = null;
}

export function start(): void {
    reset();
    compute();
}

export function compute(): void {
    compute.dn = FunctionNames.DocumentCompute;
    const body = document.body;
    const d = document.documentElement;
    const bodyClientWidth = body ? body.clientWidth : null;
    const bodyScrollWidth = body ? body.scrollWidth : null;
    const bodyOffsetWidth = body ? body.offsetWidth : null;
    const documentClientWidth = d ? d.clientWidth : null;
    const documentScrollWidth = d ? d.scrollWidth : null;
    const documentOffsetWidth = d ? d.offsetWidth : null;
    const width = Math.max(
        bodyClientWidth,
        bodyScrollWidth,
        bodyOffsetWidth,
        documentClientWidth,
        documentScrollWidth,
        documentOffsetWidth,
    );

    const bodyClientHeight = body ? body.clientHeight : null;
    const bodyScrollHeight = body ? body.scrollHeight : null;
    const bodyOffsetHeight = body ? body.offsetHeight : null;
    const documentClientHeight = d ? d.clientHeight : null;
    const documentScrollHeight = d ? d.scrollHeight : null;
    const documentOffsetHeight = d ? d.offsetHeight : null;
    const height = Math.max(
        bodyClientHeight,
        bodyScrollHeight,
        bodyOffsetHeight,
        documentClientHeight,
        documentScrollHeight,
        documentOffsetHeight,
    );

    // Check that width or height has changed from before, and also that width & height are not null values
    if ((data === null || width !== data.width || height !== data.height) && width !== null && height !== null) {
        data = { width, height };
        encode(Event.Document);
    }
}

export function stop(): void {
    reset();
}
