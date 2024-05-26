import { Code, Constant, Dimension, Metric, Severity } from "@clarity-types/data";
import config from "@src/core/config";
import { bind } from "@src/core/event";
import measure from "@src/core/measure";
import { setTimeout } from "@src/core/timeout";
import * as dimension from "@src/data/dimension";
import * as metric from "@src/data/metric";
import * as internal from "@src/diagnostic/internal";
import * as navigation from "@src/performance/navigation";

let observer: PerformanceObserver;
const types: string[] = [Constant.Navigation, Constant.Resource, Constant.LongTask, Constant.FID, Constant.CLS, Constant.LCP];
let sessionEntries: PerformanceEntry[] = [];
let sessionValue = 0;

export function start(): void {
    // Capture connection properties, if available
    if (navigator && "connection" in navigator) {
        dimension.log(Dimension.ConnectionType, navigator["connection"]["effectiveType"]);
    }

    // Check the browser support performance observer as a pre-requisite for any performance measurement
    if (window["PerformanceObserver"] && PerformanceObserver.supportedEntryTypes) {
        // Start monitoring performance data after page has finished loading.
        // If the document.readyState is not yet complete, we intentionally call observe using a setTimeout.
        // This allows us to capture loadEventEnd on navigation timeline.
        if (document.readyState !== "complete") {
            bind(window, "load", setTimeout.bind(this, observe, 0));
        } else { observe(); }
    } else { internal.log(Code.PerformanceObserver, Severity.Info); }
    sessionEntries = [];
    sessionValue = 0;
}

function observe(): void {
    // Some browsers will throw an error for unsupported entryType, e.g. "layout-shift"
    // In those cases, we log it as a warning and continue with rest of the Clarity processing
    try {
        if (observer) { observer.disconnect(); }
        observer = new PerformanceObserver(measure(handle) as PerformanceObserverCallback);
        // Reference: https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver/observe
        // "buffered" flag indicates whether buffered entries should be queued into the observer's buffer.
        // It must only be used only with the "type" option, and cannot be used with entryTypes.
        // This is why we need to individually "observe" each supported type
        for (let x of types) {
            if (PerformanceObserver.supportedEntryTypes.indexOf(x) >= 0) {
                // Initialize CLS with a value of zero. It's possible (and recommended) for sites to not have any cumulative layout shift.
                // In those cases, we want to still initialize the metric in Clarity
                if (x === Constant.CLS) { metric.sum(Metric.CumulativeLayoutShift, 0); }
                observer.observe({type: x, buffered: true});
            }
        }
    } catch { internal.log(Code.PerformanceObserver, Severity.Warning); }
}

function handle(entries: PerformanceObserverEntryList): void {
    process(entries.getEntries());
}

function process(entries: PerformanceEntryList): void {
    let visible = "visibilityState" in document ? document.visibilityState === "visible" : true;
    for (let i = 0; i < entries.length; i++) {
        let entry = entries[i];
        switch (entry.entryType) {
            case Constant.Navigation:
                navigation.compute(entry as PerformanceNavigationTiming);
                break;
            case Constant.Resource:
                let name = entry.name;
                dimension.log(Dimension.NetworkHosts, host(name));
                if (name === config.upload || name === config.fallback) { metric.max(Metric.UploadTime, entry.duration); }
                break;
            case Constant.LongTask:
                metric.count(Metric.LongTaskCount);
                break;
            case Constant.FID:
                if (visible) { metric.max(Metric.FirstInputDelay, entry["processingStart"] - entry.startTime); }
                break;
            case Constant.CLS:
                if (visible) {
                    calculateCls(entry);
                }
                break;
            case Constant.LCP:
                if (visible) { metric.max(Metric.LargestPaint, entry.startTime); }
                break;
        }
    }
}

function calculateCls(entry: PerformanceEntry): void {
    if(entry["hadRecentInput"]) { return; }
    
    const firstSessionEntry = sessionEntries[0];
    const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

    // If the entry occurred less than 1 second after the previous entry
    // and less than 5 seconds after the first entry in the session,
    // include the entry in the current session. Otherwise, start a new
    // session.
    // For more info: https://web.dev/articles/cls
    if (
        sessionValue &&
        lastSessionEntry && (entry.startTime - lastSessionEntry.startTime < 1000) &&
        firstSessionEntry && (entry.startTime - firstSessionEntry.startTime < 5000)
    ) {
        sessionValue += entry["value"];
        sessionEntries.push(entry);
    } else {
        sessionValue = entry["value"];
        sessionEntries = [entry];
    }
    // Scale the value to avoid sending back floating point number
    metric.max(Metric.CumulativeLayoutShift, entry["value"] * 1000)
}

export function stop(): void {
    if (observer) { observer.disconnect(); }
    observer = null;
    sessionEntries = [];
    sessionValue = 0;
}

function host(url: string): string {
    let a = document.createElement("a");
    a.href = url;
    return a.host;
}
