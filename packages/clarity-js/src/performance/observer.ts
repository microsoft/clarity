import { Code } from "@clarity-types/data";
import { LargestContentfulPaintEntry, LongTaskEntry } from "@clarity-types/performance";
import { bind } from "@src/core/event";
import measure from "@src/core/measure";
import { setTimeout } from "@src/core/timeout";
import * as internal from "@src/diagnostic/internal";
import * as contentful from "@src/performance/contentfulPaint";
import * as longtask from "@src/performance/longtask";
import * as navigation from "@src/performance/navigation";
import * as network from "@src/performance/network";
import * as paint from "@src/performance/paint";

let observer: PerformanceObserver;
let polling: boolean;
let lastEntryIndex: number = 0;

export function start(): void {
    // Check the browser support performance object as a pre-requisite for any performance measurement
    if (performance && "getEntries" in performance) {
        // Start monitoring performance data after page has finished loading.
        // If the document.readyState is not yet complete, we intentionally call observe using a setTimeout.
        // This allows us to capture loadEventEnd on navigation timeline.
        if (document.readyState !== "complete") {
            bind(window, "load", setTimeout.bind(this, observe, 0));
        } else { observe(); }
    }
}

export function compute(): void {
    if (polling) { process(performance.getEntries(), lastEntryIndex); }
}

function observe(): void {
    lastEntryIndex = 0;
    process(performance.getEntries(), 0);
    // For browsers that support observers, we let browser push new entries to us as and when they happen.
    // In all other cases we manually look out for new entries and process them as we discover them.
    if (window["PerformanceObserver"]) {
        if (observer) { observer.disconnect(); }
        observer = new PerformanceObserver(measure(handle) as PerformanceObserverCallback);
        observer.observe({entryTypes: ["navigation", "resource", "longtask", "paint", "largest-contentful-paint"]});
    } else { polling = true; }
}

function handle(entries: PerformanceObserverEntryList): void {
    process(entries.getEntries(), 0);
}

function process(entries: PerformanceEntryList, offset: number): void {
    if (entries && entries.length > offset) {
        for (let i = offset; i < entries.length; i++) {
            let entry = entries[i];
            switch (entry.entryType) {
                case "navigation":
                    navigation.compute(entry as PerformanceNavigationTiming);
                    break;
                case "resource":
                    network.compute(entry as PerformanceResourceTiming);
                    break;
                case "paint":
                    paint.compute(entry);
                    break;
                case "longtask":
                    longtask.compute(entry as LongTaskEntry);
                    break;
                case "largest-contentful-paint":
                    contentful.compute(entry as LargestContentfulPaintEntry);
                    break;
            }
            lastEntryIndex++;
        }
    } else { internal.error(Code.PerformanceObserver, null); }
}

export function end(): void {
    if (observer) { observer.disconnect(); }
    observer = null;
    lastEntryIndex = 0;
    polling = false;
}
