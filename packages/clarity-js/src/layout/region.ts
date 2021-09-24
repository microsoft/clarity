import { Event, Setting } from "@clarity-types/data";
import { InteractionState, RegionData, RegionState, RegionQueue, RegionVisibility } from "@clarity-types/layout";
import { time } from "@src/core/time";
import * as dom from "@src/layout/dom";
import encode from "@src/layout/encode";

export let state: RegionState[] = [];
let regionMap: WeakMap<Node, string> = null; // Maps region nodes => region name
let regions: { [key: number]: RegionData } = {};
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

export function track(id: number, event: Event): void {
    let node = dom.getNode(id);
    let data = id in regions ? regions[id] : { id, visibility: RegionVisibility.Rendered, interaction: InteractionState.None, name: regionMap.get(node) };
    
    // Determine the interaction state based on incoming event
    let interaction = InteractionState.None;
    switch (event) {
        case Event.Click: interaction = InteractionState.Clicked; break;
        case Event.Input: interaction = InteractionState.Input; break;
    }
    // Process updates to this region, if applicable
    process(node, data, interaction, data.visibility);
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
                state.push(clone(r.data));
            } else { q.push(r); }
        }
    }
    queue = q;

    // Schedule encode only when we have at least one valid data entry
    if (state.length > 0) { encode(Event.Region); }
}

function handler(entries: IntersectionObserverEntry[]): void {
    for (let entry of entries) {
        let target = entry.target;
        let rect = entry.boundingClientRect;
        let overlap = entry.intersectionRect;
        let viewport = entry.rootBounds;
        // Only capture regions that have non-zero width or height to avoid tracking and sending regions
        // that cannot ever be seen by the user. In some cases, websites will have a multiple copy of the same region
        // like search box - one for desktop, and another for mobile. In those cases, CSS media queries determine which one should be visible.
        // Also, if these regions ever become non-zero width or height (through AJAX, user action or orientation change) - we will automatically start monitoring them from that point onwards
        if (regionMap.has(target) && rect.width + rect.height > 0 && viewport.width > 0 && viewport.height > 0) {
            let id = target ? dom.getId(target) : null;
            let data = id in regions ? regions[id] : { id, name: regionMap.get(target), interaction: InteractionState.None, visibility: RegionVisibility.Rendered };
            
            // For regions that have relatively smaller area, we look at intersection ratio and see the overlap relative to element's area
            // However, for larger regions, area of regions could be bigger than viewport and therefore comparison is relative to visible area
            let viewportRatio = overlap ? (overlap.width * overlap.height * 1.0) / (viewport.width * viewport.height) : 0;
            let visible = viewportRatio > Setting.ViewportIntersectionRatio || entry.intersectionRatio > Setting.IntersectionRatio;
            // If an element is either visible or was visible and has been scrolled to the end
            // i.e. Scrolled to end is determined by if the starting position of the element + the window height is more than the total element height. 
            // starting position is relative to the viewport - so Intersection observer returns a negative value for rect.top to indicate that the element top is above the viewport
            let scrolledToEnd = (visible || data.visibility == RegionVisibility.Visible) && Math.abs(rect.top) + viewport.height > rect.height;
            // Process updates to this region, if applicable
            process(target, data, data.interaction, 
                        (scrolledToEnd ? 
                            RegionVisibility.ScrolledToEnd :
                            (visible ? RegionVisibility.Visible : RegionVisibility.Rendered)));

            // Stop observing this element now that we have already received scrolled signal
            if (data.visibility >= RegionVisibility.ScrolledToEnd && observer) { observer.unobserve(target); }
        }
    }
    if (state.length > 0) { encode(Event.Region); }
}

function process(n: Node, d: RegionData, s: InteractionState, v: RegionVisibility): void {
    // Check if received a state that supersedes existing state
    let updated = s > d.interaction || v > d.visibility;
    d.interaction = s > d.interaction ? s : d.interaction;
    d.visibility = v > d.visibility ? v : d.visibility;
    // If the corresponding node is already discovered, update the internal state
    // Otherwise, track it in a queue to reprocess later.
    if (d.id) {
        if ((d.id in regions && updated) || !(d.id in regions)) {
            regions[d.id] = d;
            state.push(clone(d));
        }
    } else { queue.push({node: n, data: d}); }
}

function clone(r: RegionData): RegionState {
    return { time: time(), data: { id: r.id, interaction: r.interaction, visibility: r.visibility, name: r.name }};
}

export function reset(): void {
    state = [];   
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
