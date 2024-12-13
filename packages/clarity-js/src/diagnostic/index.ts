import * as fraud from "@src/diagnostic/fraud";
import * as internal from "@src/diagnostic/internal";
import * as script from "@src/diagnostic/script";

export function start(): void {
    fraud.start();
    script.start();
    internal.start();
}
start.displayName = "diagnosticStart";

export function stop(): void {
    internal.stop();
}
