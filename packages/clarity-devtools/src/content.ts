import { clarity, Layout } from "clarity-js";
import { regions } from "./regions";

chrome.runtime.onMessage.addListener(function(message: any): void {
  if (message.action === "activate") {
    activate();
  } else if (message.action === "warn") {
    console.warn(message.message);
  }
});

chrome.runtime.sendMessage({ action: "activate" }, function(response: any): void {
  if (response && response.success) {
    activate();
  }
});

function activate(): void {
  if (clarity) {
    window[Layout.Constant.DevHook] = {};
    chrome.storage.sync.get({
      clarity: { showText: true, leanMode: false }
    }, (items: any) => {
      clarity.start({
        delay: 500,
        lean: items.clarity.leanMode,
        regions,
        content: items.clarity.showText,
        upload,
        projectId: "devtools"
      });
      // Send a custom event
      clarity.event("Developer Tools", "start");
      // Set a sample variable
      clarity.set("App", "Developer Tools");
    });
    window["clarity"] = clarity;
  }
}

function upload(data: string): void {
  chrome.runtime.sendMessage({ action: "payload", payload: data }, function(response: any): void {
    if (!(response && response.success)) {
      console.warn("Payload failure, dev tools likely not open.");
    }
  });
}
