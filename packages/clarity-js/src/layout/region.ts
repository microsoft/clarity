import { Event, Metric, BooleanFlag } from "@clarity-types/data";
import { Box, RegionData } from "@clarity-types/layout";
import config from "@src/core/config";
import * as task from "@src/core/task";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import encode from "@src/layout/encode";
import * as dom from "./dom";

let bm: { [key: number]: RegionData } = {};
let updateMap: number[] = [];
let timeout: number = null;

export function compute(): void {
    clearTimeout(timeout);
    timeout = setTimeout(schedule, config.lookahead);
}

function schedule(): void {
    task.schedule(region);
}

async function region(): Promise<void> {
    let timer = Metric.LayoutCost;
    task.start(timer);
    let values = dom.regions();
    let viewport = getViewport();

    for (let value of values) {
        if (task.shouldYield(timer)) {
            await task.suspend(timer);
            viewport = getViewport();
        }
        update(value.id, layout(dom.getNode(value.id) as Element, viewport));
    }

    if (updateMap.length > 0) { await encode(Event.Region); }
    task.stop(timer);
}

export function updates(): RegionData[] {
    let summary = [];
    for (let id of updateMap) {
        summary.push(bm[id]);
    }
    updateMap = [];
    return summary;
}

function getViewport(): Box {
    let de = document.documentElement;
    return {
        x: "pageXOffset" in window ? window.pageXOffset : de.scrollLeft,
        y: "pageYOffset" in window ? window.pageYOffset : de.scrollTop,
        w: de && "clientWidth" in de ? de.clientWidth : window.innerWidth,
        h: de && "clientHeight" in de ? de.clientHeight : window.innerHeight,
        v: BooleanFlag.True
    };
}

function update(id: number, box: Box): void {
    let changed = box !== null;

    // Compare the new box coordinates with what we had in memory from before
    if (id in bm && box !== null && bm[id].box !== null) {
        let old = bm[id].box;
        changed = (box.x === old.x && box.y === old.y && box.w === old.w && box.h === old.h && box.v === old.v) ? false : true;
    }

    if (changed) {
        if (updateMap.indexOf(id) === -1) { updateMap.push(id); }
        let value = dom.getValue(id);
        let r = value ? dom.region(value.region) : null;
        bm[id] = { id, box, region: r };
    }
}

export function track(id: number) {
    if (updateMap.indexOf(id) === -1) {
        updateMap.push(id);
        encode(Event.Region);
    }
}

export function layout(element: Element, viewport: Box = null): Box {
    let box: Box = null;
    if (typeof element.getBoundingClientRect === "function") {
        // getBoundingClientRect returns rectangle relative positioning to viewport
        let rect = element.getBoundingClientRect();

        if (rect && rect.width > 0 && rect.height > 0) {
            viewport = viewport || getViewport();
            let visible =
                // Top of rectangle is lesser than the bottom of the viewport
                rect.top <= viewport.h &&
                // Bottom of rectangle is greater than the top of the viewport
                rect.top + rect.height >= 0 &&
                // Left of rectangle is lesser than the right of the viewport
                rect.left <= viewport.w &&
                // Right of rectangle is greater than the left of the viewport
                rect.left + rect.width >= 0 &&
                // The current page is visible
                ("visibilityState" in document ? document.visibilityState === "visible" : true);

            // Add viewport's scroll position to rectangle to get position relative to document origin
            // Also: using Math.floor() instead of Math.round() because in Edge,
            // getBoundingClientRect returns partial pixel values (e.g. 162.5px) and Chrome already
            // floors the value (e.g. 162px). This keeps consistent behavior across browsers.
            box = {
                x: Math.floor(rect.left + viewport.x),
                y: Math.floor(rect.top + viewport.y),
                w: Math.floor(rect.width),
                h: Math.floor(rect.height),
                v: visible ? BooleanFlag.True : BooleanFlag.False
            };
        }
    }
    return box;
}

export function reset(): void {
    clearTimeout(timeout);
    updateMap = [];
    bm = {};
}
