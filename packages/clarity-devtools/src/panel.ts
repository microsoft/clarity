import { Data, decode } from "clarity-decode";
import { Visualizer } from "clarity-visualize";

let visualize = new Visualizer();
let activeTabId = chrome.devtools.inspectedWindow.tabId;
console.log('[Clarity DevTools] Panel: Connecting to background for tab', activeTabId);

let background: chrome.runtime.Port | null = null;
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 200;
let isReconnecting = false;
let disconnectListener: (() => void) | null = null;
let messageListener: ((message: { action?: string; payload?: string }) => void) | null = null;

let sessionId = "";
let pageNum = 0;
let events: Data.DecodedEvent[] = [];
let eJson: string[][] = [];
let pJson: string[] = [];
let dJson: Data.DecodedPayload[] = [];

const enum Mode {
    Encoded = 0,
    Decoded = 1,
    Merged = 2
}

function handleMessage(message: { action?: string; payload?: string }): void {
    if (message?.payload) {
        try {
            const decoded = decode(message.payload);
            if (decoded.envelope.sequence === 1) { 
                reset(decoded.envelope, decoded.dimension?.[0].data[0][0]); 
            }
            pJson.push(JSON.parse(message.payload));
            dJson.push(copy(decoded));
            const merged = visualize.merge([decoded]);
            events = events.concat(merged.events).sort(sort);
            visualize.dom(merged.dom);
        } catch (error) {
            console.error('[Clarity DevTools] Panel: Error handling message:', error);
        }
    }
}

function connectToBackground(): void {
    if (isReconnecting) {
        console.log('[Clarity DevTools] Panel: Connection attempt already in progress');
        return;
    }
    
    isReconnecting = true;
    
    try {
        if (background) {
            try {
                if (disconnectListener) {
                    background.onDisconnect.removeListener(disconnectListener);
                }
                if (messageListener) {
                    background.onMessage.removeListener(messageListener);
                }
                background.disconnect();
            } catch (e) {
                // Ignore disconnect errors
            }
        }
        
        background = chrome.runtime.connect({ name: "panel" });
        console.log('[Clarity DevTools] Panel: Connected to background, port name:', background.name);
        
        disconnectListener = () => {
            console.log('[Clarity DevTools] Panel: Background connection disconnected');
            isReconnecting = false;
            
            if (retryCount < MAX_RETRIES) {
                retryCount++;
                console.log('[Clarity DevTools] Panel: Attempting reconnect', retryCount, 'of', MAX_RETRIES);
                setTimeout(() => connectToBackground(), RETRY_DELAY * retryCount);
            } else {
                console.error('[Clarity DevTools] Panel: Max reconnection attempts reached');
            }
        };
        background.onDisconnect.addListener(disconnectListener);

        messageListener = handleMessage;
        background.onMessage.addListener(messageListener);
        
        console.log('[Clarity DevTools] Panel: Sending init message for tab', activeTabId);
        background.postMessage({ action: "init", tabId: activeTabId });
        console.log('[Clarity DevTools] Panel: Init message sent');
        retryCount = 0;
        isReconnecting = false;
    } catch (error) {
        console.error('[Clarity DevTools] Panel: Failed to connect to background', error);
        isReconnecting = false;
        
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.log('[Clarity DevTools] Panel: Retrying connection', retryCount, 'of', MAX_RETRIES);
            setTimeout(() => connectToBackground(), RETRY_DELAY * retryCount);
        }
    }
}

connectToBackground();

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