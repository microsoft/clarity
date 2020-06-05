import { Data, Diagnostic, Interaction } from "clarity-decode";

// Scope: Session, Use case: Keeps track of hashes across pages to detect collisions
let hashes: { [hash: string]: string[] } = {};

let activeTabId = chrome.devtools.inspectedWindow.tabId;
let background = chrome.runtime.connect({ name: "panel" });

export function process(decoded: Data.DecodedPayload): void {
    // Walk through hashes and look for any potential collisions
    // Hash check is across pages
    if (decoded.dom) {
        for (let dom of decoded.dom) {
            for (let d of dom.data) {
                if (!(d.hash in hashes)) { hashes[d.hash] = []; }
                if (hashes[d.hash].indexOf(d.selector) === -1) { hashes[d.hash].push(d.selector); }
                if (hashes[d.hash].length > 1) {
                    warn(`Hash collision: ${hashes[d.hash].join()}`);
                }
            }
        }
    }

    // Walk through various events, and discover referenced targets
    if (decoded.pointer) { decoded.pointer.forEach( (x: Interaction.InteractionEvent) => target(x)); }
    if (decoded.scroll) { decoded.scroll.forEach( (x: Interaction.InteractionEvent) => target(x)); }
    if (decoded.input) { decoded.input.forEach( (x: Interaction.InteractionEvent) => target(x)); }
    if (decoded.image) { decoded.image.forEach( (x: Diagnostic.DiagnosticEvent) => target(x)); }
    if (decoded.selection) {
        decoded.selection.forEach( (x: Interaction.SelectionEvent) => {
            target(x, "start");
            target(x, "end");
        });
    }
}

function target(event: any, field: string = "target"): void {
    let t = event.data[field] as number;
    let json = JSON.stringify(event);
    if (t === null) {
        warn(`Null target detected: ${t} | Event: ${json}`);
    }
}

function warn(message: string): void {
    console.warn("Posting message: " + message);
    background.postMessage({ action: "warn", tabId: activeTabId, message });
}
