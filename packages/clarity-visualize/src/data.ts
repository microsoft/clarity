import { Data, Layout } from "clarity-js";
import type { Data as DecodedData, Layout as DecodedLayout } from "clarity-decode";
import { PlaybackState, RegionState } from "@clarity-types/visualize";

export class DataHelper {
    regionMap = {};
    regions: { [key: string]:  RegionState} = {};
    metrics: {[key: number]: number} = {};
    lean = false;
    state: PlaybackState;

    constructor(state: PlaybackState) {
        this.state = state;
    }

    static METRIC_MAP = {
        [Data.Metric.TotalBytes]: { name: "Total Bytes", unit: "KB" },
        [Data.Metric.TotalCost]: { name: "Total Cost", unit: "ms" },
        [Data.Metric.LayoutCost]: { name: "Layout Cost", unit: "ms" },
        [Data.Metric.LargestPaint]: { name: "LCP", unit: "s" },
        [Data.Metric.CumulativeLayoutShift]: { name: "CLS", unit: "cls" },
        [Data.Metric.LongTaskCount]: { name: "Long Tasks" },
        [Data.Metric.CartTotal]: { name: "Cart Total", unit: "html-price" },
        [Data.Metric.ProductPrice]: { name: "Product Price", unit: "ld-price" },
        [Data.Metric.ThreadBlockedTime]: { name: "Thread Blocked", unit: "ms" }
    };

    public reset = (): void => {
        this.metrics = {};
        this.lean = false;
        this.regions = {};
        this.regionMap = {};
    }

    public metric = (event: DecodedData.MetricEvent): void => {
        if (this.state.options.metadata) { 
            let metricMarkup = [];
            let regionMarkup = [];
            // Copy over metrics for future reference
            for (let m in event.data) {
                if (typeof event.data[m] === "number") {
                    if (!(m in this.metrics)) { this.metrics[m] = 0; }
                    let key = parseInt(m, 10);
                    if (m in DataHelper.METRIC_MAP && (DataHelper.METRIC_MAP[m].unit === "html-price" ||DataHelper.METRIC_MAP[m].unit === "ld-price")) { 
                        this.metrics[m] = event.data[m];
                    } else { this.metrics[m] += event.data[m]; }
                    this.lean = key === Data.Metric.Playback && event.data[m] === 0 ? true : this.lean;
                }
            }

            for (let entry in this.metrics) {
                if (entry in DataHelper.METRIC_MAP) {
                    let m = this.metrics[entry];
                    let map = DataHelper.METRIC_MAP[entry];
                    let unit = "unit" in map ? map.unit : Data.Constant.Empty;
                    metricMarkup.push(`<li><h2>${this.value(m, unit)}<span>${this.key(unit)}</span></h2>${map.name}</li>`);
                }
            }

            // Append region information to metadata
            for (let name in this.regions) {
                let r = this.regions[name];
                let className = (r.visibility === Layout.RegionVisibility.Visible ? "visible" : (r.interaction === Layout.InteractionState.Clicked ? "clicked" : Data.Constant.Empty));
                regionMarkup.push(`<span class="${className}">${name}</span>`);
            }

            this.state.options.metadata.innerHTML = `<ul>${metricMarkup.join(Data.Constant.Empty)}</ul><div>${regionMarkup.join(Data.Constant.Empty)}</div>`;
        }
    }

    public region(event: DecodedLayout.RegionEvent): void {
        let data = event.data;
        for (let r of data) {
            if (!(r.name in this.regions)) { 
                this.regions[r.name] = { interaction: r.interaction , visibility: r.visibility }
            }
            this.regionMap[r.id] = r.name;
        }
    }

    private key = (unit: string): string => {
        switch (unit) {
            case "html-price": 
            case "ld-price": 
            case "cls":
                return Data.Constant.Empty;
            default: return unit;
        }
    }

    private value = (num: number, unit: string): number => {
        switch (unit) {
            case "KB": return Math.round(num / 1024);
            case "s": return Math.round(num / 10) / 100;
            case "cls": return num / 1000;
            case "html-price": return num / 100;
            default: return num;
        }
    }
}
