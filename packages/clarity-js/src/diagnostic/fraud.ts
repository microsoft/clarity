import { BooleanFlag, Event, IframeStatus, Metric, Setting } from "@clarity-types/data";
import { FraudData } from "@clarity-types/diagnostic";
import config from "@src/core/config";
import hash from "@src/core/hash";
import * as metric from "@src/data/metric";
import encode from "./encode";

let history = [];
export let data: FraudData;

export function start(): void {
    history = [];
    metric.max(Metric.Automation, navigator.webdriver ? BooleanFlag.True : BooleanFlag.False);
    try {
        metric.max(Metric.Iframed, window.top == window.self ? IframeStatus.TopFrame : IframeStatus.Iframe);
    } catch (ex) {
        metric.max(Metric.Iframed, IframeStatus.Unknown);
    }
    
}

export function check(id: number, target: number, input: string): void {
    // Compute hash for fraud detection, if enabled. Hash is computed only if input meets the minimum length criteria
    if (config.fraud && id !== null && input && input.length >= Setting.WordLength) {
        data = { id, target, checksum: hash(input, Setting.ChecksumPrecision) };
        // Only encode this event if we haven't already reported this hash
        if (history.indexOf(data.checksum) < 0) {
            history.push(data.checksum);
            encode(Event.Fraud);
        }
    }
}

export function stop(): void {
    history = [];
}