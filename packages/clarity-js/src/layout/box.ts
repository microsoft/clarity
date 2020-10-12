import { Event, Setting } from "@clarity-types/data";
import { BoxData } from "@clarity-types/layout";
import * as dom from "@src/layout/dom";
import encode from "@src/layout/encode";

export let data: BoxData[] = [];
let enabled = false;
let observer: ResizeObserver = null;

export function start(): void {
    reset();
    observer = null;
    enabled = window["ResizeObserver"] ? true : false;
}

export function compute(id: number): void {
    if (enabled === false) { return; }
    observer = observer === null ? new ResizeObserver(handler) : observer;
    if (observer) {
        let value = dom.getValue(id);
        // If this is the first time computing size for this node, go ahead and wire up ResizeObserver
        // In all other cases, value.metadata.size will be null or an array with two elements [width, height]
        // And, in those cases, we will skip through the following section and not attach the observer
        if (value && value.metadata.size !== null && value.metadata.size.length === 0) {
            let node = dom.getNode(id);
            if (node && node.nodeType === Node.ELEMENT_NODE) {
                let e = node as HTMLElement;
                let r = e.getBoundingClientRect();
                value.metadata.size = [Math.floor(r.width * Setting.BoxPrecision), Math.floor(r.height * Setting.BoxPrecision)];
                observer.observe(e);
            }
        }
    }
}

function handler(entries: ResizeObserverEntry[]): void {
    window.requestAnimationFrame(() => {
        for (let entry of entries) {
            let target = entry.target;
            let id = target ? dom.getId(target) : null;
            if (id) {
                let v = dom.getValue(id);
                let s = v.metadata.size;
                let b = entry.borderBoxSize as any;
                let w = null;
                let h = null;
                // Check if browser supports borderBoxSize property on ResizeObserverEntry object
                // Otherwise, fall back to using getBoundingClientRect() to be cross browser compatible
                // Reference: https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserverEntry/borderBoxSize
                if(b && b.length > 0) {
                    w = Math.floor(b[0].inlineSize * Setting.BoxPrecision);
                    h = Math.floor(b[0].blockSize * Setting.BoxPrecision);
                } else {
                    let r = target.getBoundingClientRect();
                    w = Math.floor(r.width * Setting.BoxPrecision);
                    h = Math.floor(r.height * Setting.BoxPrecision);
                }

                // Capture new width & height only if they are different from what we have in in-memory cache
                if (w !== s[0] && h !== s[1]) {
                    s = [w,h];
                    data.push({ id, width: w, height: h });
                }
            }
        }

        // Schedule encode only when we have at least one valid data entry
        if (data.length > 0) { encode(Event.Box); }
    });
}

export function reset(): void {
    data = [];
}

export function stop(): void {
    reset();
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    enabled = false;
}
