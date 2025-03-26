import { FunctionNames } from "@clarity-types/performance";
import * as navigation from "@src/performance/navigation";
import * as observer from "@src/performance/observer";

export function start(): void {
    start.dn = FunctionNames.PerformanceStart;
    navigation.reset();
    observer.start();
}

export function stop(): void {
    observer.stop();
    navigation.reset();
}
