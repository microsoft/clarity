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
  if (clarity && clarity.active === false) {
    window[Layout.Constant.DEVTOOLS_HOOK] = {};
    chrome.storage.sync.get({
      clarity: { showText: true, leanMode: false }
    }, (items: any) => {
      if (items.clarity.showText) { document.body.setAttribute(Layout.Constant.UNMASK_ATTRIBUTE, "true"); }
      clarity.start({
        lookahead: 10,
        delay: 50,
        lean: items.clarity.leanMode,
        regions,
        upload,
        projectId: 1051133397904 // parseInt("devtools", 36);
      });
      // Add a sample tag
      clarity.tag("start-developer-tools");
      // Set a sample variable
      clarity.set("App", "Developer Tools");
      // Use identify API
      clarity.identify("X", "Y", "Z");
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
