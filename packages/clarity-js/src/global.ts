import * as clarity from "@src/clarity";

// Expose clarity in a browser environment
// To be efficient about queuing up operations while Clarity is wiring up, we expose clarity.*(args) => clarity(*, args);
// This allows us to reprocess any calls that we missed once Clarity is available on the page
(function(): void {
    if (typeof window !== "undefined") {
        const w = window as any;
        if (w.clarity && !w.clarity.q) { console.warn("Error CL001: Multiple Clarity tags detected."); }
        const queue = w.clarity ? (w.clarity.q || []) : [];
        w.clarity = function(method: string, ...args: any[]): void { return clarity[method](...args); }
        while (queue.length > 0) { w.clarity(...queue.shift()); }
    }
})();
