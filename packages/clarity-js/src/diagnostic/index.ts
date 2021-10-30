import * as internal from "./internal";
import * as script from "./script";

export function start(): void {
    script.start();
    internal.start();
}

export function stop(): void {
    internal.stop();
}
