import { Metric } from "@clarity-types/data";
import config from "@src/core/config";
import * as metric from "@src/data/metric";

// tslint:disable-next-line: ban-types
export default function(method: Function): Function {
    return function(): void {
        let start = performance.now();
        method.apply(this, arguments);
        let duration = performance.now() - start;
        metric.accumulate(Metric.TotalCost, duration);
        metric.count(Metric.InvokeCount);
        if (duration > config.longtask) {
            metric.count(Metric.LongTaskCount);
            metric.max(Metric.ThreadBlockTime, duration);
        }
    };
}
