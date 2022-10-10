import { ClaritySignal } from "@clarity-types/data";

function parseSignals(signalsString: string): ClaritySignal[] {
    const signalsJson: ClaritySignal[] = JSON.parse(signalsString)
    return signalsJson;
}

export function dispatchClarityLiveSignalsEvents(signalsString: string) {
    try {
        const signalsJson = parseSignals(signalsString);
        signalsJson.forEach(signal => {
            const customSignalEvent = new CustomEvent("clarityLiveSignal", {detail: signal})
            window.dispatchEvent(customSignalEvent)
        })
    } catch {
        //do nothing
    }
}