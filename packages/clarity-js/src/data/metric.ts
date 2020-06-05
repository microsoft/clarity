import { Event, Metric, MetricData } from "@clarity-types/data";
import encode from "./encode";

export let data: MetricData = null;
export let updates: Metric[] = [];

export function start(): void {
    data = {};
}

export function end(): void {
    data = {};
}

export function count(metric: Metric, increment: number = 1): void {
    if (!(metric in data)) { data[metric] = 0; }
    data[metric] += increment;
    track(metric);
}

export function accumulate(metric: Metric, value: number): void {
    if (!(metric in data)) { data[metric] = 0; }
    data[metric] += value;
    track(metric);
}

export function max(metric: Metric, value: number): void {
    if (!(metric in data)) { data[metric] = 0; }
    data[metric] = Math.max(value, data[metric]);
    track(metric);
}

export function compute(): void {
    encode(Event.Metric);
}

function track(metric: Metric): void {
    if (updates.indexOf(metric) === -1) {
        updates.push(metric);
    }
}

export function reset(): void {
    updates = [];
}
