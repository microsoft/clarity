import { Event } from "@clarity-types/data";
import { ResizeData, Setting } from "@clarity-types/interaction";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import { bind } from "@src/core/event";
import encode from "./encode";
import { schedule } from "@src/core/task";

export let data: ResizeData;
let timeout: number = null;

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
    clearTimeout(timeout);
    timeout = setTimeout(process, Setting.LookAhead, Event.Resize);
}

function process(event: Event): void {
    schedule(encode.bind(this, event));
}

export function reset(): void {
    data = null;
    clearTimeout(timeout);
}

export function stop(): void {
    reset();
}