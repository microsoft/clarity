import { BooleanFlag, Event, Setting } from "@clarity-types/data";
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
        observer = observer === null && watch ? new IntersectionObserver(handler, {
            // Get notified as intersection continues to change
            // This allows us to process regions that get partially hidden during the lifetime of the page
            // See: https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API#creating_an_intersection_observer
            // By default, intersection observers only fire an event when even a single pixel is visible and not thereafter.
            threshold: [0,0.2,0.4,0.6,0.8,1]
        }) : observer;
        if (observer && node && node.nodeType === Node.ELEMENT_NODE) {
            observer.observe(node as Element);
        }
    }
}

export function exists(node: Node): boolean {
    // Check if regionMap is not null before looking up a node
    // Since, dom module stops after region module, it's possible that we may set regionMap to be null
    // and still attempt to call exists on a late coming DOM mutation (or addition), effectively causing a script error
    return regionMap && regionMap.has(node);
}

export function track(id: number): void {
    // Do not send another entry if we are already sending it
    let node = dom.getNode(id);
    if (updates.indexOf(id) <= 0 && regionMap.has(node)) {
        regions[id] = id in regions ? regions[id] : { id, visible: BooleanFlag.False, region: regionMap.get(node) };
        data.push(regions[id]);
    }
}

export function compute(): void {
    // Process any regions where we couldn't resolve an "id" for at the time of last intersection observer event
    // This could happen in cases where elements are not yet processed by Clarity's virtual DOM but browser reports a change, regardless.
    // For those cases we add them to the queue and re-process them below
    let q = [];
    for (let r of queue) {
        let id = dom.getId(r.node);
        if (!(id in regions)) {
            if (id) {
                r.data.id = id;
                regions[id] = r.data;
                data.push(r.data);
            } else { q.push(r); }
        }
    }
    queue = q;

    // Schedule encode only when we have at least one valid data entry
    if (data.length > 0) { encode(Event.Region); }
}

function handler(entries: IntersectionObserverEntry[]): void {
    for (let entry of entries) {
        let target = entry.target;
        let rect = entry.boundingClientRect;
        let overlap = entry.intersectionRect;
        let viewport = entry.rootBounds;
        // Only capture regions that have non-zero area to avoid tracking and sending regions
        // that cannot ever be seen by the user. In some cases, websites will have a multiple copy of the same region
        // like search box - one for desktop, and another for mobile. In those cases, CSS media queries determine which one should be visible.
        // Also, if these regions ever become non-zero area (through AJAX, user action or orientation change) - we will automatically start monitoring them from that point onwards
        if (regionMap.has(target) && rect.width > 0 && rect.height > 0 && viewport.width > 0 && viewport.height > 0) {
            let id = target ? dom.getId(target) : null;
            let viewportRatio = overlap ? (overlap.width * overlap.height * 1.0) / (viewport.width * viewport.height) : 0;
            // For regions that have relatively smaller area, we look at intersection ratio and see the overlap relative to element's area
            // However, for larger regions, area of regions could be bigger than viewport and therefore comparison is relative to visible area
            let visible = viewportRatio > Setting.ViewportIntersectionRatio || entry.intersectionRatio > Setting.IntersectionRatio ? BooleanFlag.True : BooleanFlag.False;
            // If the visibility hasn't changed since the last tracked value, ignore this notification
            if (!(id in regions && regions[id].visible === visible)) {
                let d = { id, visible, region: regionMap.get(target) };
                if (id) {
                    regions[id] = d;
                    updates.push(id);
                    data.push(d);
                } else { queue.push({node: target, data: d}); }
            }
        }
    }
    if (data.length > 0) { encode(Event.Region); }
}

export function reset(): void {
    data = [];    
    updates = [];
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
