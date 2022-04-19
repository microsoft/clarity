import * as internal from "./internal";
import * as script from "./script";
import * as trace from "./trace";
export {trace} from "@src/diagnostic/trace";

export function start(): void {
    script.start();
    internal.start();
}

export function compute(): void {
    trace.compute();
}

export function stop(): void {
    internal.stop();
}
