import { Event, SummaryData, Setting } from "@clarity-types/data";
import encode from "./encode";

export let data: SummaryData = null;

export function start(): void {
    data = {};
}

export function stop(): void {
    data = {};
}

export function track(event: Event, time: number): void {
    if (!(event in data)) {
        data[event] = [[time, 0]];
    } else {
        let e = data[event];
        let last = e[e.length - 1];
        // Add a new entry only if the new event occurs after configured interval
        // Otherwise, extend the duration of the previous entry
        if (time - last[0] > Setting.SummaryInterval) {
            data[event].push([time, 0]);
        } else { last[1] = time - last[0]; }
    }
}

export function compute(): void {
    encode(Event.Summary);
}

export function reset(): void {
    data = {};
}
