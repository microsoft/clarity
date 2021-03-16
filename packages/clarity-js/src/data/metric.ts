import { Code, Constant, Event, Metric, MetricData, Severity } from "@clarity-types/data";
import * as log from "@src/diagnostic/log";
import encode from "./encode";

export let data: MetricData = null;
export let updates: MetricData = null;
const regex = /[^0-9\.]/g;

export function start(): void {
    data = {};
    updates = {};
    count(Metric.InvokeCount);
}

export function stop(): void {
    data = {};
    updates = {};
}

export function extract(metric: Metric, element: HTMLElement): void {
    try {
        let value = Math.round(parseFloat(element.innerText.replace(regex, Constant.Empty)) * 100);
        max(metric, value);
    } catch { log.log(Code.Metric, null, Severity.Info); };
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
    if (value !== null) { 
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
