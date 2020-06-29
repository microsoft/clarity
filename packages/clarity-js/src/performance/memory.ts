import { Event } from "@clarity-types/data";
import { MemoryData, PerformanceMemory } from "@clarity-types/performance";
import encode from "@src/performance/encode";

// Reference: https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory
export let data: MemoryData = null;

export function reset(): void {
    data = null;
}

export function compute(): void {
    // Reference: https://trackjs.com/blog/monitoring-javascript-memory/
    // At the moment, this is available in Chrome only.
    if (performance && "memory" in performance) {
        let memory = (performance["memory"] as PerformanceMemory);
        let current = {
            limit: memory.jsHeapSizeLimit,
            available: memory.totalJSHeapSize,
            consumed: memory.usedJSHeapSize,
        };
        // Send back updated memory stats only if consumed memory has changed by at least 5%
        if (data === null || (Math.abs(current.consumed - data.consumed) / data.consumed) > 0.05) {
            data = current;
            encode(Event.Memory);
        }
    }
}
