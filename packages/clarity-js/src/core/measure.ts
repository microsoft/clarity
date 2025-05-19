import { Code, Metric, Setting, Severity } from "@clarity-types/data";
import { report } from "@src/core/report";
import * as metric from "@src/data/metric";
import * as internal from "@src/diagnostic/internal";

// biome-ignore lint/complexity/noBannedTypes: specifically looking to instrument function calls
export default function (method: Function): Function {
    return function (...args): void {
        const start = performance.now();
        try {
            method.apply(this, args);
        } catch (ex) {
            throw report(ex);
        }
        const duration = performance.now() - start;
        metric.sum(Metric.TotalCost, duration);
        if (duration > Setting.LongTask) {
            metric.count(Metric.LongTaskCount);
            metric.max(Metric.ThreadBlockedTime, duration);
            internal.log(Code.FunctionExecutionTime, Severity.Info, `${method.dn || method.name}-${duration}`);
        }
    };
}
