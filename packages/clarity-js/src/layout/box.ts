import { Event, Setting } from "@clarity-types/data";
import { BoxData } from "@clarity-types/layout";
import * as dom from "@src/layout/dom";
import encode from "@src/layout/encode";

export let data: BoxData[] = [];
let enabled = false;
let observer: ResizeObserver = null;

export function start(): void {
    data = [];
    observer = null;
    enabled = window["ResizeObserver"] ? true : false;
}

export function compute(): void {
    if (enabled === false) { return; }
    observer = observer === null ? new ResizeObserver(handler) : observer;
    if (observer) {
        let boxes = dom.boxes();
        for (let element of boxes) { observer.observe(element); }
    }
}

function handler(entries: ResizeObserverEntry[]): void {
    for (let entry of entries) {
        let target = entry.target;
        let id = target ? dom.getId(target) : null;
        if (id) {
            let v = dom.getValue(id);
            let s = entry.borderBoxSize as any;
            // Check if browser supports borderBoxSize property on ResizeObserverEntry object
            // Otherwise, fall back to using getBoundingClientRect() to be cross browser compatible
            // Reference: https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserverEntry/borderBoxSize
            if(s && s.length > 0) {
                v.metadata.width = Math.floor(s[0].inlineSize * Setting.BoxPrecision);
                v.metadata.height = Math.floor(s[0].blockSize * Setting.BoxPrecision);
            } else {
                let r = target.getBoundingClientRect();
                v.metadata.width = Math.floor(r.width * Setting.BoxPrecision);
                v.metadata.height = Math.floor(r.height * Setting.BoxPrecision);
            }
            data.push({ id, width: v.metadata.width, height: v.metadata.height });
        }
    }
    encode(Event.Box);
}

export function stop(): void {
    data = [];
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    enabled = false;

}
