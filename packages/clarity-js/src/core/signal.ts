import { ClaritySignal } from "@clarity-types/data";
import { signalCallback } from "@src/data/signal";
import { determineAction } from "@src/core/action";

function parseSignals(signalsString: string): ClaritySignal[] {
    const signalsJson: ClaritySignal[] = JSON.parse(signalsString)
    return signalsJson;
}

export function signalEvent(signalsString: string) {
    try {
        const signals = parseSignals(signalsString);

        // Check whether user is frustrated or not
        // if yes, execute an action based on configuration
        if(!signalCallback) determineAction();
        signals.forEach(signal => {
            signalCallback(signal)
        })
    } catch (err) {
    }
}
