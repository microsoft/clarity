import { Event, Metric, MetricData } from "@clarity-types/data";
import encode from "./encode";

export let data: MetricData = null;
export let updates: MetricData = null;

export function start(): void {
    data = {};
    updates = {};
    count(Metric.InvokeCount);
}

export function stop(): void {
    data = {};
    updates = {};
}

export function count(metric: Metric, increment: number = 1): void {
    if (!(metric in data)) { data[metric] = 0; }
    if (!(metric in updates)) { updates[metric] = 0; }
    data[metric] += increment;
    updates[metric] += increment;
}

export function sum(metric: Metric, value: number): void {
    if (value !== null) { 
        if (!(metric in data)) { data[metric] = 0; }
        if (!(metric in updates)) { updates[metric] = 0; }
        data[metric] += value;
        updates[metric] += value;
    }
}

export function max(metric: Metric, value: number): void {
    // Ensure that we do not process null or NaN values
    if (value !== null && isNaN(value) === false) { 
        if (!(metric in data)) { data[metric] = 0; }
        if (value > data[metric] || data[metric] === 0) {
            updates[metric] = value;
            data[metric] = value;
        }
    }
}

export function compute(): void {
    encode(Event.Metric);
}

export function reset(): void {
    updates = {};
}
