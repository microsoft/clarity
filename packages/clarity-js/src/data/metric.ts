import { Code, Constant, Event, Metric, MetricData, Severity } from "@clarity-types/data";
import * as log from "@src/diagnostic/log";
import encode from "./encode";

export let data: MetricData = null;
export let updates: MetricData = null;
let metricMap: WeakMap<Node, string> = null; // Maps metric nodes => innerText
const formatRegex = /1/g;
const digitsRegex = /[^0-9\.]/g;
const digitsWithCommaRegex = /[^0-9\.,]/g;

export function start(): void {
    data = {};
    updates = {};
    metricMap = new WeakMap();
    count(Metric.InvokeCount);
}

export function stop(): void {
    data = {};
    updates = {};
    metricMap = null;
}

export function extract(metric: Metric, element: Element): void {
    try {
        let text = (element as HTMLElement).innerText;
        // Only re-process element if either the element is just discovered or the inner text has changed
        if (metricMap.has(element) === false || metricMap.get(element) !== text) {
            metricMap.set(element, text);
            let value = parseNumber(text);
            max(metric, value ? value : 0); // Default value to zero in case we are unable to parse text
        }
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

function parseNumber(text: string): number {
    // Reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
    let lang = document.documentElement.lang;
    if (Intl && Intl.NumberFormat && lang) {
        text = text.replace(digitsWithCommaRegex, Constant.Empty);
        // Infer current group and decimal separator from current locale
        let group = Intl.NumberFormat(lang).format(11111).replace(formatRegex, Constant.Empty);
        let decimal = Intl.NumberFormat(lang).format(1.1).replace(formatRegex, Constant.Empty);
        
        // Prase number using inferred group and decimal separators
        return Math.round(parseFloat(text
            .replace(new RegExp('\\' + group, 'g'), Constant.Empty)
            .replace(new RegExp('\\' + decimal), Constant.Dot)
        ) * 100);
    }

    // Fallback to en locale
    return Math.round(parseFloat(text.replace(digitsRegex, Constant.Empty)) * 100);
}
