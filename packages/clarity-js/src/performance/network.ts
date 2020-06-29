import { Event } from "@clarity-types/data";
import { NetworkState } from "@clarity-types/performance";
import config from "@src/core/config";
import { schedule } from "@src/core/task";
import { time } from "@src/core/time";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import encode from "@src/performance/encode";

export let state: NetworkState[] = [];
let timeout: number = null;

export function compute(entry: PerformanceResourceTiming): void {
    // Do not instrument calls to configured upload URL
    // This will prevent getting this code into cyclic loop:
    //   - An upload triggers a new network request, which in turn will be captured by PerformanceObserver
    //   - And, this new performance entry will cause code below to queue up a new event, eventually leading to another upload
    if (config.url.length > 0 && entry.name.indexOf(config.url) >= 0) { return; }

    state.push({
        url: entry.name,
        data: {
            start: time(entry.startTime),
            duration: Math.round(entry.duration),
            size: "transferSize" in entry ? Math.round(entry.transferSize) : null,
            target: null,
            initiator: "initiatorType" in entry ? entry.initiatorType : null,
            protocol: "nextHopProtocol" in entry ? entry.nextHopProtocol : null,
            host: host(entry.name)
        }
    });
    clearTimeout(timeout);
    timeout = setTimeout(process, config.lookahead, Event.Network);
}

function process(event: Event): void {
    schedule(encode.bind(this, event));
}

function host(url: string): string {
    let a = document.createElement("a");
    a.href = url;
    return a.hostname;
}

export function reset(): void {
    state = [];
}
