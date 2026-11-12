import { reset as navReset } from "@src/performance/navigation";
import { start as obsStart, stop as obsStop } from "@src/performance/observer";

export function start(): void {
    navReset();
    obsStart();
}

export function stop(): void {
    obsStop();
    navReset();
}
