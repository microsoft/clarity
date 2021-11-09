import { Setting } from "@clarity-types/core";
import { Metric } from "@clarity-types/data";
import { report } from "@src/core/report";
import * as metric from "@src/data/metric";

// tslint:disable-next-line: ban-types
export default function (method: Function): Function {
    return function (): void {
        let start = performance.now();
        try { method.apply(this, arguments); } catch (ex) { throw report(ex); }
        let duration = performance.now() - start;
        metric.sum(Metric.TotalCost, duration);
        if (duration > Setting.LongTask) {
            metric.count(Metric.LongTaskCount);
            metric.max(Metric.ThreadBlockedTime, duration);
        }
    };
}
