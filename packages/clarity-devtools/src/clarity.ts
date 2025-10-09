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

        // Listen for configuration from content script
        window.addEventListener("message", function(event: MessageEvent): void {
            if (event.source === window && event.data.action === "clarity-start") {
                // Add the upload callback (can't be sent via postMessage)
                const settings = event.data.settings;
                settings.upload = function(data: string): void {
                    window.postMessage({ action: "upload", payload: data }, "*");
                };
                // Start Clarity with the provided settings
                w[c]("start", settings);
            }
        });

        // Notify developer tools that clarity-js is wired up
        window.postMessage({ action: "wireup" }, "*");
    }
})();