import { start as fraudStart } from "@src/diagnostic/fraud";
import { start as intStart, stop as intStop } from "@src/diagnostic/internal";
import { start as scrStart } from "@src/diagnostic/script";

export function start(): void {
    fraudStart();
    scrStart();
    intStart();
}

export function stop(): void {
    intStop();
}
