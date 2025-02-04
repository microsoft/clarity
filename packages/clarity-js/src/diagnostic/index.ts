import { FunctionNames } from "@clarity-types/performance";
import * as fraud from "@src/diagnostic/fraud";
import * as internal from "@src/diagnostic/internal";
import * as script from "@src/diagnostic/script";

export function start(): void {
    start.dn = FunctionNames.DiagnosticStart;
    fraud.start();
    script.start();
    internal.start();
}

export function stop(): void {
    internal.stop();
}
