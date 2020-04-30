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
    data = {
        width: "innerWidth" in window ? window.innerWidth : document.documentElement.clientWidth,
        height: "innerHeight" in window ? window.innerHeight : document.documentElement.clientHeight
    };
    encode(Event.Resize);
}

export function reset(): void {
    data = null;
}

export function end(): void {
    reset();
}