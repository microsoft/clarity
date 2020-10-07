import { Data, decode } from "clarity-decode";
import { visualize } from "clarity-visualize";

let activeTabId = chrome.devtools.inspectedWindow.tabId;
let background = chrome.runtime.connect({ name: "panel" });
background.postMessage({ action: "init", tabId: activeTabId });
let sessionId = "";
let pageNum = 0;
let events: Data.DecodedEvent[] = [];
let eJson: string[][] = []; // Encoded JSON for the whole session
let pJson: string[] = []; // Encoded JSON for the page
let dJson: Data.DecodedPayload[] = []; // Decoded JSON for the page

function save(encoded: boolean = true): void {
    let data;
    let id = `${sessionId}-${pageNum}`;
    let suffix = "decoded";
    if (encoded) {
        // Temporarily append data from the current page
        eJson.push(pJson);
        // Beautify data by injecting line breaks
        data = JSON.stringify(eJson).replace(/\[\{"e"/g, '\r\n  [{"e"').replace("]}]]", "]}]\r\n]");
        // Clean up temporary data from above
        eJson.pop();
        id = sessionId;
        suffix = "encoded";
    } else { data = JSON.stringify(dJson, null, 2); }
    let blob = new Blob([data], {type: "application/json"});
    let url  = URL.createObjectURL(blob);
    let a = document.createElement("a");
    a.setAttribute("download", `clarity-${id.toUpperCase()}-${suffix}.json`);
    a.href = url;
    a.click();
}

background.onMessage.addListener(function(message: any): void {
    // Handle responses from the background page, if any
    if (message && message.payload) {
        let decoded = decode(message.payload);
        if (decoded.envelope.sequence === 1) { reset(decoded.envelope); }
        pJson.push(JSON.parse(message.payload));
        dJson.push(decoded);
        let merged = visualize.merge([decoded]);
        events = events.concat(merged.events).sort(sort);
        visualize.dom(merged.dom);
    }
});

function replay(): void {
    // Execute only if there are events to render
    if (events.length > 0) {
        let event = events[0];
        let end = event.time + 16; // 60FPS => 16ms / frame
        let index = 0;
        while (event && event.time < end) {
            event = event[++index];
        }
        visualize.render(events.splice(0, index));
    }
    requestAnimationFrame(replay);
}

function resize(width: number, height: number): void {
    let margin = 10;
    let px = "px";
    let iframe = document.getElementById("clarity") as HTMLIFrameElement;
    let container = iframe.ownerDocument.documentElement;
    let offsetTop = iframe.offsetTop;
    let availableWidth = container.clientWidth - (2 * margin);
    let availableHeight = container.clientHeight - offsetTop - (2 * margin);
    let scale = Math.min(Math.min(availableWidth / width, 1), Math.min(availableHeight / height, 1));
    iframe.style.position = "absolute";
    iframe.style.width = width + px;
    iframe.style.height = height + px;
    iframe.style.transformOrigin = "0 0 0";
    iframe.style.transform = "scale(" + scale + ")";
    iframe.style.border = "1px solid #cccccc";
    iframe.style.overflow = "hidden";
    iframe.style.left = ((container.clientWidth - (width * scale)) / 2) + px;
}

function reset(envelope: Data.Envelope): void {
    if (console) { console.clear(); }
    let info = document.getElementById("info");
    let metadata = document.getElementById("header") as HTMLDivElement;
    let iframe = document.getElementById("clarity") as HTMLIFrameElement;
    let download = document.getElementById("download") as HTMLElement;
    if (iframe) { iframe.parentElement.removeChild(iframe); }
    iframe = document.createElement("iframe");
    iframe.id = "clarity";
    iframe.title = "Clarity Developer Tools";
    iframe.setAttribute("scrolling", "no");
    document.body.appendChild(iframe);
    console.log("Clearing out previous session... moving on to next one.");
    if (sessionId !== envelope.sessionId) {
        eJson = [];
        sessionId = envelope.sessionId;
    } else { eJson.push(pJson); }
    events = [];
    pJson = [];
    dJson = [];
    pageNum = envelope.pageNum;
    info.style.display = "none";
    metadata.style.display = "block";
    download.style.display = "block";
    iframe.style.display = "block";
    (download.firstChild as HTMLElement).onclick = function(): void { save(true); };
    (download.lastChild as HTMLElement).onclick = function(): void { save(false); };
    visualize.setup(envelope.version, iframe, resize, metadata);
}

function sort(a: Data.DecodedEvent, b: Data.DecodedEvent): number {
    return a.time - b.time;
}

// Call replay on every animation frame to emulate near real-time playback
requestAnimationFrame(replay);
