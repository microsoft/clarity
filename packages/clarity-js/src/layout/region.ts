import { BooleanFlag, Event } from "@clarity-types/data";
import { RegionData, RegionQueue } from "@clarity-types/layout";
import * as dom from "@src/layout/dom";
import encode from "@src/layout/encode";

export let data: RegionData[] = [];
let regionMap: WeakMap<Node, string> = null; // Maps region nodes => region name
let regions: { [key: number]: RegionData } = {};
let updates: number[] = [];
let queue: RegionQueue[] = [];
let watch = false;
let observer: IntersectionObserver = null;

export function start(): void {
    reset();
    observer = null;
    regionMap = new WeakMap();
    regions = {};
    queue = [];
    watch = window["IntersectionObserver"] ? true : false;
    
}

export function observe(node: Node, name: string): void {
    if (regionMap.has(node) === false) {
        regionMap.set(node, name);
        observer = observer === null && watch ? new IntersectionObserver(handler) : observer;
        if (observer && node && node.nodeType === Node.ELEMENT_NODE) {
            observer.observe(node as Element);
        }
    }
}

export function exists(node: Node): boolean {
    return regionMap.has(node);
}

export function track(id: number): void {
    // Do not send another entry if we are already sending it
    let node = dom.getNode(id);
    if (updates.indexOf(id) <= 0 && regionMap.has(node)) {
        data.push(id in regions ? regions[id] : { id, visible: BooleanFlag.False, region: regionMap.get(node) });
    }
}

export function compute(): void {
    // Process any regions that couldn't be processed earlier
    let q = [];
    for (let r of queue) {
        let id = dom.getId(r.node);
        if (id) {
            r.data.id = id;
            data.push(r.data);
        } else { q.push(r); }
    }
    queue = q;

    // Schedule encode only when we have at least one valid data entry
    if (data.length > 0) { encode(Event.Region); }
}

function handler(entries: IntersectionObserverEntry[]): void {
    for (let entry of entries) {
        let target = entry.target;
        let rect = entry.boundingClientRect;

        // Only capture regions that are not hidden on the page
        if (regionMap.has(target) && rect.width > 0 && rect.height > 0) {
            let id = target ? dom.getId(target) : null;
            let visible = entry.isIntersecting ? BooleanFlag.True : BooleanFlag.False;
            let d = { id, visible, region: regionMap.get(target) };
            if (id) {
                regions[id] = d;
                updates.push(id);
                data.push(d);
            } else { queue.push({node: target, data: d}); }
        }
    }
    if (data.length > 0) { encode(Event.Region); }
}

export function reset(): void {
    data = [];
}

export function stop(): void {
    reset();
    regionMap = null;
    regions = {};
    queue = [];
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    watch = false;
}
