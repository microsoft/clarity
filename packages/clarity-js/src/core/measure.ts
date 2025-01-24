import { Code, Metric, Setting, Severity } from "@clarity-types/data";
import { report } from "@src/core/report";
import * as metric from "@src/data/metric";
import * as internal from "@src/diagnostic/internal";

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
            internal.log(Code.FunctionExecutionTime, Severity.Info, `${method.dn || method.name}-${duration}`);
        }
    };
}
