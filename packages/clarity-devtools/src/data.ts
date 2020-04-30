import { Data, Diagnostic, Interaction } from "clarity-decode";

// Scope: Session, Usecase: Keeps track of hashes across pages to detect colissions
let hashes: { [hash: string]: string[] } = {};

let activeTabId = chrome.devtools.inspectedWindow.tabId;
let background = chrome.runtime.connect({ name: "panel" });
let lookup: { [id: number]: string } = {};

export function process(decoded: Data.DecodedPayload): void {
    // Maintain statelessness and initialize to empty object
    // Keeps track of mapping between ids & hash
    lookup = {};

    // Walk through all elements in the payload specified in Event.Target
    if (decoded.target) {
        for (let t of decoded.target) {
            for (let d of t.data) {
                lookup[d.id] = d.hash;
            }
        }
    }

    // Walk through hashes and look for any potential collisions
    // Hash check is across pages
    if (decoded.hash) {
        for (let hash of decoded.hash) {
            for (let h of hash.data) {
                if (!(h.hash in hashes)) { hashes[h.hash] = []; }
                if (hashes[h.hash].indexOf(h.selector) === -1) { hashes[h.hash].push(h.selector); }
                if (hashes[h.hash].length > 1) {
                    warn(`Hash collision: ${hashes[h.hash].join()}`);
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
    let hash = lookup[t];
    let json = JSON.stringify(event);
    if (t !== null && !hash) {
        warn(`Missing target detected: ${t} | Event: ${json}`);
    } else if (t === null) {
        warn(`Null target detected: ${t} | Event: ${json}`);
    }
}

function warn(message: string): void {
    console.warn("Posting message: " + message);
    background.postMessage({ action: "warn", tabId: activeTabId, message });
}
