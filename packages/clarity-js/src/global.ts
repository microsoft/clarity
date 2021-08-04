import * as clarity from "@src/clarity";

// Expose clarity in a browser environment
// To be efficient about queuing up operations while Clarity is wiring up, we expose clarity.*(args) => clarity(*, args);
// This allows us to reprocess any calls that we missed once Clarity is available on the page
// Once Clarity script bundle is loaded on the page, we also initialize a "v" property that holds current version
// We use the presence or absence of "v" to determine if we are attempting to run a duplicate instance
(function(): void {
    if (typeof window !== "undefined") {
        const w = window as any;
        const c = 'clarity';
        
        // Do not execute or reset global "clarity" variable if a version of Clarity is already running on the page
        if (w[c] && w[c].v) { return console.warn("Error CL001: Multiple Clarity tags detected."); }
        
        // Re-wire global "clarity" variable to map it to current instance of Clarity
        const queue = w[c] ? (w[c].q || []) : [];
        w[c] = function(method: string, ...args: any[]): void { return clarity[method](...args); }
        w[c].v = clarity.version;
        while (queue.length > 0) { w[c](...queue.shift()); }
    }
})();
