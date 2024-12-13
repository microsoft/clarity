import { FunctionNames } from "@clarity-types/performance";
import * as navigation from "@src/performance/navigation";
import * as observer from "@src/performance/observer";

export function start(): void {
    navigation.reset();
    observer.start();
}
start.dn = FunctionNames.PerformanceStart;

export function stop(): void {
    observer.stop();
    navigation.reset();
}
