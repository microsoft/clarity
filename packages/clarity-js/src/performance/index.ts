import * as navigation from "@src/performance/navigation";
import * as observer from "@src/performance/observer";

export function start(): void {
    navigation.reset();
    observer.start();
}

export function stop(): void {
    observer.stop();
    navigation.reset();
}
