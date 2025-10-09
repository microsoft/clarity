import { Data, decode } from "clarity-decode";
import { Visualizer } from "clarity-visualize";

let visualize = new Visualizer();
let activeTabId = chrome.devtools.inspectedWindow.tabId;
let background: chrome.runtime.Port | null = null;
let sessionId = "";
let pageNum = 0;
let events: Data.DecodedEvent[] = [];
let eJson: string[][] = []; // Encoded JSON for the whole session
let pJson: string[] = []; // Encoded JSON for the page
let dJson: Data.DecodedPayload[] = []; // Decoded JSON for the page

// Connect to background with retry logic for service worker timing issues
function connectWithRetry(retries: number = 5, delay: number = 100): void {
    try {
        background = chrome.runtime.connect({ name: "panel" });

        // Set up message listener
        background.onMessage.addListener(handleMessage);

        // Set up disconnect handler to retry on failure
        background.onDisconnect.addListener(() => {
            if (chrome.runtime.lastError && retries > 0) {
                console.log('Connection disconnected, retrying...', chrome.runtime.lastError.message);
                background = null;
                setTimeout(() => connectWithRetry(retries - 1, delay * 2), delay);
            } else if (chrome.runtime.lastError) {
                console.error('Failed to connect to background service worker after multiple attempts');
            }
        });

        // Send init message after successful connection
        background.postMessage({ action: "init", tabId: activeTabId });

    } catch (error) {
        if (retries > 0) {
            console.log('Connection error, retrying...', error);
            setTimeout(() => connectWithRetry(retries - 1, delay * 2), delay);
        } else {
            console.error('Failed to connect to background service worker after multiple attempts', error);
        }
    }
}

// Initialize connection
connectWithRetry();

const enum Mode {
    Encoded = 0,
    Decoded = 1,
    Merged = 2
}

function save(mode: Mode): void {
    let json: string;
    let suffix: string;
    let id = `${sessionId}-${pageNum}`;
    switch (mode) {
        case Mode.Encoded:
            // Temporarily append data from the current page
            eJson.push(pJson);
            // Beautify data by injecting line breaks
            json = JSON.stringify(eJson).replace(/\[\{"e"/g, '\r\n  [{"e"').replace("]}]]", "]}]\r\n]");
            // Clean up temporary data from above
            eJson.pop();
            id = sessionId;
            suffix = "encoded";
            break;
        case Mode.Decoded:
            json = JSON.stringify(dJson, null, 2);
            suffix = "decoded";
            break;
        case Mode.Merged:
            json = JSON.stringify(visualize.merge(copy(dJson)), null, 2);
            suffix = "merged";
            break;
    }
    let blob = new Blob([json], {type: "application/json"});
    let url  = URL.createObjectURL(blob);

    let a = document.createElement("a");
    a.setAttribute("download", `clarity-${id}-${suffix}.json`);
    a.href = url;
    a.click();
}

function handleMessage(message: any): void {
    // Ignore keepalive messages
    if (message && message.action === "keepalive") {
        return;
    }

    // Handle responses from the background page, if any
    if (message && message.payload) {
        let decoded = decode(message.payload);
        if (decoded.envelope.sequence === 1) { reset(decoded.envelope, decoded.dimension?.[0].data[0][0]); }
        pJson.push(JSON.parse(message.payload));
        dJson.push(copy(decoded)); // Save a copy of JSON
        let merged = visualize.merge([decoded]);
        events = events.concat(merged.events).sort(sort);
        visualize.dom(merged.dom);
    }
}

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

function reset(envelope: Data.Envelope, userAgent: string): void {
    if (console) { console.clear(); }
    let info = document.getElementById("info");
    let metadata = document.getElementById("header") as HTMLDivElement;
    let iframe = document.getElementById("clarity") as HTMLIFrameElement;
    let download = document.getElementById("download") as HTMLElement;
    let links = download.querySelectorAll("a");
    if (iframe) { iframe.parentElement.removeChild(iframe); }
    iframe = document.createElement("iframe");
    iframe.id = "clarity";
    iframe.title = "Microsoft Clarity Developer Tools";
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
    for (let i = 0; i < links.length; i++) {
        (links[i] as HTMLElement).onclick = function(): void { save(i); };
    }
    const mobile = isMobileDevice(userAgent);
    visualize.setup(iframe.contentWindow, { version: envelope.version, onresize: resize, metadata, mobile, vNext: true, locale: 'en-us', onclickMismatch: (args) => console.log(`${args.time}|${args.x}|${args.y}|${args.nodeId}`) });
}

function sort(a: Data.DecodedEvent, b: Data.DecodedEvent): number {
    return a.time - b.time;
}

function copy(input: any): any {
    return JSON.parse(JSON.stringify(input));
}

// Call replay on every animation frame to emulate near real-time playback
requestAnimationFrame(replay);

function isMobileDevice(userAgent: string): boolean {
    if(!userAgent) { return false; }

    return /android|webos|iphone|ipad|ipod|blackberry|windows phone|opera mini|iemobile|mobile|silk|fennec|bada|tizen|symbian|nokia|palmsource|meego|sailfish|kindle|playbook|bb10|rim/i.test(userAgent);
}