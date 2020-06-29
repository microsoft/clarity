import { Event } from "@clarity-types/data";
import { LongTaskEntry, LongTaskState } from "@clarity-types/performance";
import { time } from "@src/core/time";
import encode from "@src/performance/encode";

// Reference: https://w3c.github.io/longtasks/#sec-PerformanceLongTaskTiming
export let state: LongTaskState = null;

export function reset(): void {
    state = null;
}

export function compute(entry: LongTaskEntry): void {
    state = {
        time: time(entry.startTime),
        data: {
            duration: Math.round(entry.duration),
            attributionName: entry.attribution && entry.attribution.length > 0 ? entry.attribution[0].name : null,
            attributionContainer: entry.attribution && entry.attribution.length > 0 ? entry.attribution[0].containerType : null,
            attributionType: entry.attribution && entry.attribution.length > 0 ? entry.attribution[0].entryType : null,
            name: entry.name
        }
    };
    encode(Event.LongTask);
}
