import { Event } from "@clarity-types/data";
import { NavigationData } from "@clarity-types/performance";
import encode from "./encode";

export let data: NavigationData = null;

export function reset(): void {
    data = null;
}

export function compute(entry: PerformanceNavigationTiming): void {
    data = {
        fetchStart: Math.round(entry.fetchStart),
        connectStart: Math.round(entry.connectStart),
        connectEnd: Math.round(entry.connectEnd),
        requestStart: Math.round(entry.requestStart),
        responseStart: Math.round(entry.responseStart),
        responseEnd: Math.round(entry.responseEnd),
        domInteractive: Math.round(entry.domInteractive),
        domComplete: Math.round(entry.domComplete),
        loadEventStart: Math.round(entry.loadEventStart),
        loadEventEnd: Math.round(entry.loadEventEnd),
        redirectCount: Math.round(entry.redirectCount),
        size: entry.transferSize ? entry.transferSize : 0,
        type: entry.type,
        protocol: entry.nextHopProtocol,
        encodedSize: entry.encodedBodySize ? entry.encodedBodySize : 0,
        decodedSize: entry.decodedBodySize ? entry.decodedBodySize : 0
    };
    encode(Event.Navigation);
}
