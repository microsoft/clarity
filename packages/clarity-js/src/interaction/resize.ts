import { Event } from "@clarity-types/data";
import { ResizeData } from "@clarity-types/interaction";
import { bind } from "@src/core/event";
import encode from "./encode";

export let data: ResizeData;

export function start(): void {
    bind(window, "resize", recompute);
    recompute();
}

function recompute(): void {
    let de = document.documentElement;
    // window.innerWidth includes width of the scrollbar and is not a true representation of the viewport width.
    // Therefore, when possible, use documentElement's clientWidth property.
    data = {
        width: de && "clientWidth" in de ? Math.min(de.clientWidth, window.innerWidth) : window.innerWidth,
        height: de && "clientHeight" in de ? Math.min(de.clientHeight, window.innerHeight) : window.innerHeight,
    };
    encode(Event.Resize);
}

export function reset(): void {
    data = null;
}

export function stop(): void {
    reset();
}