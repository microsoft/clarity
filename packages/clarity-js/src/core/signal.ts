import { ClaritySignal } from "@clarity-types/data";
import { signalCallback } from "@src/data/signal";
import { determineAction } from "@src/core/action";

function parseSignals(signalsString: string): ClaritySignal[] {
    const signalsJson: ClaritySignal[] = JSON.parse(signalsString)
    return signalsJson;
}


const LiveSignalType: Map<string, number> = new Map([
    ["BotSignal", 0],
    ["FrustrationScore", 1],
    ["PurchaseProbability", 2]
  ]);

export function signalEvent(signalsString: string) {
    let botThreshold : number = 0.5;
    let frustrationThreshold : number = 0.65;
    let purchaseThreshold : number = 0.5;
    const thresholds : number[] = [botThreshold, frustrationThreshold, purchaseThreshold];
    try {
        const signals = parseSignals(signalsString);

        // Check whether user is frustrated or not
        // if yes, execute an action based on configuration
        if(!signalCallback) determineAction();
        signals.forEach(signal => {
            if (signal["value"] > thresholds[LiveSignalType.get(signal["type"])]) {
                signalCallback(signal);
            }
        })
    } catch (err) { }
}
