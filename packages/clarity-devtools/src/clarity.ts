import { clarity, version, helper } from "clarity-js";

// Execute clarity-js in context of the webpage
(function(): void {
    if (typeof window !== "undefined") {
        const w = window as any;
        const c = 'clarity';

        // Stop any existing instance of clarity-js
        if (w[c]) { w[c]("stop"); }

        // Re-wire clarity-js for developer tools and expose helper methods as part of the global object
        w[c] = function(method: string, ...args: any[]): void { return clarity[method](...args); }
        w[c].h = function(method: string, ...args: any[]): void { return helper[method](...args); }
        w[c].v = version;

        // Notify developer tools that clarity-js is wired up
        window.postMessage({ action: "wireup" }, "*");
    }
})();