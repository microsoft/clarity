import { Data, decode } from "clarity-decode";
import { visualize } from "clarity-visualize";
import * as data from "./data";

let activeTabId = chrome.devtools.inspectedWindow.tabId;
let background = chrome.runtime.connect({ name: "panel" });
background.postMessage({ action: "init", tabId: activeTabId });
let id = "";
let eJson: string[] = [];
let dJson: Data.DecodedPayload[] = [];

function save(encoded: boolean = true): void {
    let json = encoded ? JSON.stringify(eJson) : JSON.stringify(dJson, null, 2);
    let blob = new Blob([json], {type: "application/json"});
    let url  = URL.createObjectURL(blob);

    let a = document.createElement("a");
    let suffix = encoded ? "encoded" : "decoded";
    a.setAttribute("download", `clarity-vnext-${id.toUpperCase()}-${suffix}.json`);
    a.href = url;
    a.click();
}

background.onMessage.addListener(function(message: any): void {
    // Handle responses from the background page, if any
    if (message && message.payload) {
        let decoded = decode(message.payload);
        if (decoded.envelope.sequence === 1) { reset(); }
        eJson.push(JSON.parse(message.payload));
        dJson.push(decoded);
        data.process(decoded);
        id = decoded.envelope.pageId;
        let info = document.getElementById("info");
        let header = document.getElementById("header") as HTMLElement;
        let download = document.getElementById("download") as HTMLElement;
        let iframe = document.getElementById("clarity") as HTMLIFrameElement;
        visualize.render(decoded, iframe, header);
        info.style.display = "none";
        header.style.display = "block";
        iframe.style.display = "block";
        download.style.display = "block";
    }
});

function reset(): void {
    if (console) { console.clear(); }
    let iframe = document.getElementById("clarity");
    let download = document.getElementById("download") as HTMLElement;
    if (iframe) { iframe.parentElement.removeChild(iframe); }
    iframe = document.createElement("iframe");
    iframe.id = "clarity";
    iframe.title = "Clarity Developer Tools";
    iframe.setAttribute("scrolling", "no");
    document.body.appendChild(iframe);
    console.log("Clearing out previous session... moving on to next one.");
    eJson = [];
    dJson = [];
    id = "";
    (download.firstChild as HTMLElement).onclick = function(): void { save(true); };
    (download.lastChild as HTMLElement).onclick = function(): void { save(false); };
}
