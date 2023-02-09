import { ClaritySignal } from "@clarity-types/data";
import { signalCallback } from "@src/data/signal";

function parseSignals(signalsString: string): ClaritySignal[] {
    const signalsJson: ClaritySignal[] = JSON.parse(signalsString)
    return signalsJson;
}

export function signalEvent(signalsString: string) {
    try {
        const signals = parseSignals(signalsString);
        signals.forEach(signal => {
            signalCallback(signal)
        })
    } catch {
        //do nothing
    }
}
