import { clarity, version, helper } from "clarity-js";

// Execute clarity-js in context of the webpage
(function(): void {
    if (typeof window !== "undefined") {
        const w = window as any;
        const c = 'clarity';
        let isStarted = false;

        // Stop any existing instance of clarity-js
        if (w[c]) { w[c]("stop"); }

        // Re-wire clarity-js for developer tools and expose helper methods as part of the global object
        w[c] = function(method: string, ...args: any[]): void { return clarity[method](...args); }
        w[c].h = function(method: string, ...args: any[]): void { return helper[method](...args); }
        w[c].v = version;

        // Notify developer tools that clarity-js is wired up
        window.postMessage({ action: "wireup" }, "*");

        // V3 CSP: Listen for settings via CustomEvent (replaces inline script injection)
        const settingsHandler = (event: any) => {
            if (isStarted) {
                console.log('[Clarity DevTools] Clarity: Already started, ignoring duplicate settings event');
                return;
            }
            
            const settings = event.detail;
            isStarted = true;
            
            w[c]("start", {
                delay: 500,
                lean: settings.leanMode,
                regions: settings.regions,
                fraud: settings.fraud,
                drop: settings.drop,
                mask: settings.mask,
                unmask: settings.unmask,
                content: settings.showText,
                upload: (data: string): void => { window.postMessage({ action: "upload", payload: data }, "*"); },
                projectId: "devtools"
            });
        };
        
        window.addEventListener('clarity-devtools-settings', settingsHandler, { once: true });
    }
})();