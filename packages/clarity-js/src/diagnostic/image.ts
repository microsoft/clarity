import { Event } from "@clarity-types/data";
import { ImageErrorData } from "@clarity-types/diagnostic";
import { bind } from "@src/core/event";
import { schedule } from "@src/core/task";
import encode from "./encode";

export let data: ImageErrorData;

export function start(): void {
    bind(document, "error", handler, true);
}

function handler(error: ErrorEvent): void {
    let element = error.target as HTMLElement;
    if (element && element.tagName === "IMG") {
        data = { source: (element as HTMLImageElement).src, target: element };
        schedule(encode.bind(this, Event.ImageError));
    }
}

export function stop(): void {
    data = null;
}
