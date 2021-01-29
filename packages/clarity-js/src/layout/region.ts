import { BooleanFlag, Event } from "@clarity-types/data";
import { RegionData } from "@clarity-types/layout";
import * as dom from "@src/layout/dom";
import encode from "@src/layout/encode";

export let data: RegionData[] = [];
let regionMap: WeakMap<Node, string> = null; // Maps region nodes => region name
let regions: { [key: number]: RegionData } = {};
let updates: number[] = [];
let watch = false;
let observer: IntersectionObserver = null;

export function start(): void {
    reset();
    observer = null;
    regionMap = new WeakMap();
    regions = {};
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
    // Schedule encode only when we have at least one valid data entry
    if (data.length > 0) { encode(Event.Region); }
}

function handler(entries: IntersectionObserverEntry[]): void {
    for (let entry of entries) {
        let target = entry.target;
        let id = target ? dom.getId(target) : null;
        if (id && regionMap.has(target)) {
            let visible = entry.isIntersecting ? BooleanFlag.True : BooleanFlag.False;
            let d = { id, visible, region: regionMap.get(target) };
            regions[id] = d;
            updates.push(id);
            data.push(d);
        }
    }
    compute();
}

export function reset(): void {
    data = [];
}

export function stop(): void {
    reset();
    regionMap = null;
    regions = {};
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    watch = false;
}
