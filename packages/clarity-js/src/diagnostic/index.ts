import * as fraud from "./fraud";
import * as internal from "./internal";
import * as script from "./script";

export function start(): void {
    fraud.start();
    script.start();
    internal.start();
}

export function stop(): void {
    internal.stop();
}
