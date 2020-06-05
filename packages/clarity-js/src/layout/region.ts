import { Event, Metric } from "@clarity-types/data";
import { RegionData } from "@clarity-types/layout";
import config from "@src/core/config";
import * as task from "@src/core/task";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import encode from "@src/layout/encode";
import * as dom from "./dom";

let bm: {[key: number]: RegionData} = {};
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
    let doc = document.documentElement;
    let x = "pageXOffset" in window ? window.pageXOffset : doc.scrollLeft;
    let y = "pageYOffset" in window ? window.pageYOffset : doc.scrollTop;

    for (let value of values) {
        if (task.shouldYield(timer)) {
            await task.suspend(timer);
            x = "pageXOffset" in window ? window.pageXOffset : doc.scrollLeft;
            y = "pageYOffset" in window ? window.pageYOffset : doc.scrollTop;
        }
        update(value.id, layout(dom.getNode(value.id) as Element, x, y));
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

function update(id: number, box: number[]): void {
    let changed = box !== null;
    if (id in bm && box !== null && bm[id].box !== null) {
        changed = box.length === bm[id].box.length ? false : true;
        if (changed === false) {
            for (let i = 0; i < box.length; i++) {
                if (box[i] !== bm[id].box[i]) {
                    changed = true;
                    break;
                }
            }
        }
    }

    if (changed) {
        if (updateMap.indexOf(id) === -1) { updateMap.push(id); }
        let value = dom.getValue(id);
        let r = value ? dom.region(value.region) : null;
        bm[id] = {id, box, region: r};
    }
}

export function layout(element: Element, x: number = null, y: number = null): number[] {
    let box: number[] = null;
    if (typeof element.getBoundingClientRect === "function") {
        let rect = element.getBoundingClientRect();
        x = x !== null ? x : ("pageXOffset" in window ? window.pageXOffset : document.documentElement.scrollLeft);
        y = y !== null ? y : ("pageYOffset" in window ? window.pageYOffset : document.documentElement.scrollTop);

        if (rect && rect.width > 0 && rect.height > 0) {
            // getBoundingClientRect returns relative positioning to viewport and therefore needs
            // addition of window scroll position to get position relative to document
            // Also: using Math.floor() instead of Math.round() below because in Edge,
            // getBoundingClientRect returns partial pixel values (e.g. 162.5px) and Chrome already
            // floors the value (e.g. 162px). Keeping behavior consistent across
            box = [
                Math.floor(rect.left + x),
                Math.floor(rect.top + y),
                Math.floor(rect.width),
                Math.floor(rect.height)
            ];
        }
    }
    return box;
}

export function reset(): void {
    clearTimeout(timeout);
    updateMap = [];
    bm = {};
}
