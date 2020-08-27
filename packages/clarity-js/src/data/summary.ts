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
        data[event] = [time];
    } else {
        let e = data[event];
        let last = e[e.length - 1];
        // Capture summary information only if the new event occurs after configured interval
        if (time - last > Setting.SummaryInterval) {
            data[event].push(time);
        }
    }
}

export function compute(): void {
    encode(Event.Summary);
}

export function reset(): void {
    data = {};
}
