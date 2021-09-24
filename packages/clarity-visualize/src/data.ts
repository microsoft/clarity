import { Data, Layout } from "clarity-decode";
import { state } from "./clarity";
import { RegionState } from "@clarity-types/visualize";
export let lean = false;

let regionMap = {};
let regions: { [key: string]:  RegionState} = {};
let metrics: {[key: number]: number} = null;
const METRIC_MAP = {};
METRIC_MAP[Data.Metric.TotalBytes] = { name: "Total Bytes", unit: "KB" };
METRIC_MAP[Data.Metric.TotalCost] = { name: "Total Cost", unit: "ms" };
METRIC_MAP[Data.Metric.LayoutCost] = { name: "Layout Cost", unit: "ms" };
METRIC_MAP[Data.Metric.LargestPaint] = { name: "LCP", unit: "s" };
METRIC_MAP[Data.Metric.CumulativeLayoutShift] = { name: "CLS", unit: "cls" };
METRIC_MAP[Data.Metric.LongTaskCount] = { name: "Long Tasks" };
METRIC_MAP[Data.Metric.CartTotal] = { name: "Cart Total", unit: "html-price" };
METRIC_MAP[Data.Metric.ProductPrice] = { name: "Product Price", unit: "ld-price" };
METRIC_MAP[Data.Metric.ThreadBlockedTime] = { name: "Thread Blocked", unit: "ms" };

export function reset(): void {
    metrics = {};
    lean = false;
    regions = {};
    regionMap = {};
}

export function metric(event: Data.MetricEvent): void {
    if (state.options.metadata) { 
        let metricMarkup = [];
        let regionMarkup = [];
        // Copy over metrics for future reference
        for (let m in event.data) {
            if (typeof event.data[m] === "number") {
                if (!(m in metrics)) { metrics[m] = 0; }
                let key = parseInt(m, 10);
                if (m in METRIC_MAP && (METRIC_MAP[m].unit === "html-price" || METRIC_MAP[m].unit === "ld-price")) { 
                    metrics[m] = event.data[m];
                } else { metrics[m] += event.data[m]; }
                lean = key === Data.Metric.Playback && event.data[m] === 0 ? true : lean;
            }
        }

        for (let entry in metrics) {
            if (entry in METRIC_MAP) {
                let m = metrics[entry];
                let map = METRIC_MAP[entry];
                let unit = "unit" in map ? map.unit : Data.Constant.Empty;
                metricMarkup.push(`<li><h2>${value(m, unit)}<span>${key(unit)}</span></h2>${map.name}</li>`);
            }
        }

        // Append region information to metadata
        for (let name in regions) {
            let r = regions[name];
            let className = r.interactionState === Layout.Interaction.Clicked ? "clicked" : Data.Constant.Empty;
            className += r.visibilityState === Layout.RegionVisibilityState.Visible ? "visible" : Data.Constant.Empty;
            regionMarkup.push(`<span class="${className}">${name}</span>`);
        }

        state.options.metadata.innerHTML = `<ul>${metricMarkup.join(Data.Constant.Empty)}</ul><div>${regionMarkup.join(Data.Constant.Empty)}</div>`;
    }
}

export function region(event: Layout.RegionEvent): void {
    let data = event.data;
    for (let r of data) {
        if (!(r.name in regions)) { 
            regions[r.name] = { interactionState: r.interactionState , visibilityState: r.visibilityState }
        }
        regionMap[r.id] = r.name;
    }
}

function key(unit: string): string {
    switch (unit) {
        case "html-price": 
        case "ld-price": 
        case "cls":
            return Data.Constant.Empty;
        default: return unit;
    }
}

function value(num: number, unit: string): number {
    switch (unit) {
        case "KB": return Math.round(num / 1024);
        case "s": return Math.round(num / 10) / 100;
        case "cls": return num / 1000;
        case "html-price": return num / 100;
        default: return num;
    }
}
