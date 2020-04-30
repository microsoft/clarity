import { BooleanFlag, Target } from "./data";

/* Helper Interface */

// Reference: https://wicg.github.io/largest-contentful-paint/
export interface LargestContentfulPaintEntry extends PerformanceEntry {
    renderTime: DOMHighResTimeStamp;
    loadTime: DOMHighResTimeStamp;
    size: number;
    id: string;
    url: string;
    element?: Element;
}

// Reference: https://w3c.github.io/longtasks/#sec-PerformanceLongTaskTiming
export interface LongTaskEntry extends PerformanceEntry {
    duration: number;
    attribution: LongTaskAttribution[];
}

export interface LongTaskAttribution {
    entryType: string;
    containerType: string;
    name: string;
}

// Reference: https://wicg.github.io/netinfo/#networkinformation-interface
export interface NavigatorConnection extends EventTarget {
    effectiveType: string;
    downlinkMax: number;
    downlink: number;
    rtt: number;
    saveData: boolean;
}

// Reference: https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory
export interface PerformanceMemory {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
}

export interface LongTaskState {
    time: number;
    data: LongTaskData;
}

export interface PaintState {
    time: number;
    data: PaintData;
}

export interface NetworkState {
    url: string;
    data: NetworkData;
}

/* Event Data */
export interface LongTaskData {
    duration: number;
    attributionName: string;
    attributionContainer: string;
    attributionType: string;
    name: string;
}

export interface PaintData {
    name: string;
}

export interface NetworkData {
    start: number;
    duration: number;
    size: number;
    target: Target;
    initiator: string;
    protocol: string;
    host: string;
}

export interface LargestContentfulPaintData {
    load: number;
    render: number;
    size: number;
    target: Target;
}

export interface NavigationData {
    fetchStart: number;
    connectStart: number;
    connectEnd: number;
    requestStart: number;
    responseStart: number;
    responseEnd: number;
    domInteractive: number;
    domComplete: number;
    loadEventStart: number;
    loadEventEnd: number;
    redirectCount: number;
    size: number;
    type: string;
    protocol: string;
    encodedSize: number;
    decodedSize: number;
}

export interface MemoryData {
    limit: number;
    available: number;
    consumed: number;
}

export interface ConnectionData {
    downlink: number;
    rtt: number;
    saveData: BooleanFlag;
    type: string;
}
