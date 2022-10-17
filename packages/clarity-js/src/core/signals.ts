import { ClaritySignal } from "@clarity-types/data";

function parseSignals(signalsString: string): ClaritySignal[] {
    const signalsJson: ClaritySignal[] = JSON.parse(signalsString)
    return signalsJson;
}
3
export function dispatchClarityLiveSignalsEvents(signalsString: string) {
    try {
        const signals = parseSignals(signalsString);
        dispatchSignals(signals)
    } catch {
        //do nothing
    }
}

export function dispatchSignals(signals: ClaritySignal[]) {
    signals.forEach(signal => {
        const customSignalEvent = new CustomEvent("clarityLiveSignal", {detail: signal})
        window.dispatchEvent(customSignalEvent)
    })
}