import { Event } from "@clarity-types/data";
import { LargestContentfulPaintData, LargestContentfulPaintEntry } from "@clarity-types/performance";
import { schedule } from "@src/core/task";
import { track } from "@src/data/target";
import encode from "@src/performance/encode";

// Reference: https://wicg.github.io/largest-contentful-paint/
export let data: LargestContentfulPaintData = null;

export function reset(): void {
    data = null;
}

export function compute(entry: LargestContentfulPaintEntry): void {
    data = {
        load: Math.round(entry.loadTime),
        render: Math.round(entry.renderTime),
        size: entry.size,
        target: track(entry.element)
    };
    schedule(encode.bind(this, Event.ContentfulPaint));
}
