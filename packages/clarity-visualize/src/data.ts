import { Data, Layout } from "clarity-decode";
import { state } from "./clarity";

export let lean = false;

let metrics: {[key: number]: number} = null;
const METRIC_MAP = {};
METRIC_MAP[Data.Metric.TotalBytes] = { name: "Total Bytes", unit: "KB" };
METRIC_MAP[Data.Metric.TotalCost] = { name: "Total Cost", unit: "ms" };
METRIC_MAP[Data.Metric.LayoutCost] = { name: "Layout Cost", unit: "ms" };
METRIC_MAP[Data.Metric.LongTaskCount] = { name: "Long Tasks" };
METRIC_MAP[Data.Metric.ThreadBlockTime] = { name: "Thread Blocked", unit: "ms" };

export function reset(): void {
    metrics = {};
    lean = false;
}

export function metric(event: Data.MetricEvent): void {
    if (state.metadata === null) { return; }

    let html = [];
    // Copy over metrics for future reference
    for (let m in event.data) {
        if (event.data[m]) {
            metrics[m] = event.data[m];
        }
    }

    for (let entry in metrics) {
        if (metrics[entry] && entry in METRIC_MAP) {
            let m = metrics[entry];
            let map = METRIC_MAP[entry];
            let unit = "unit" in map ? map.unit : Layout.Constant.EMPTY_STRING;
            html.push(`<li><h2>${value(m, unit)}<span>${unit}</span></h2>${map.name}</li>`);
        }
    }

    state.metadata.innerHTML = `<ul>${html.join(Layout.Constant.EMPTY_STRING)}</ul>`;
}

function value(num: number, unit: string): number {
    switch (unit) {
        case "KB": return Math.round(num / 1024);
        case "s": return Math.round(num / 1000);
        default: return num;
    }
}
