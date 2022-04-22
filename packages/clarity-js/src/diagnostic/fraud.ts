import { BooleanFlag, Event, Metric, Setting } from "@clarity-types/data";
import { FraudData } from "@clarity-types/diagnostic";
import hash from "@src/core/hash";
import * as metric from "@src/data/metric";
import encode from "./encode";

let history = [];
export let data: FraudData;

export function start(): void {
    history = [];
    metric.max(Metric.Automation, navigator.webdriver ? BooleanFlag.True : BooleanFlag.False);
}

export function check(id: number, target: number, input: string): void {
    // Compute hash for fraud detection. Hash is computed only if input meets the minimum length criteria
    if (id !== null && input && input.length >= Setting.WordLength) {
        data = { id, target, hash: hash(input) };
        // Only encode this event if we haven't already reported this hash
        if (history.indexOf(data.hash) < 0) {
            history.push(data.hash);
            encode(Event.Fraud);
        }
    }
}

export function stop(): void {
    history = [];
}