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
      setup();
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

function setup(): void {
  window.addEventListener("message", function(event: MessageEvent): void {
      if (event.source === window && event.data.styleIndex >= 0) {
          const sheet = document.styleSheets[event.data.styleIndex] as CSSStyleSheet;
          if (sheet) { sheet.insertRule(event.data.style, event.data.index); } else {
              console.warn(`Clarity: Style not found at ${event.data.styleIndex}.`);
          }
      }
  });

  // Execute script in webpage context
  let script = document.createElement("script");
  let code = proxy();
  script.innerText = code;
  document.body.appendChild(script);
}

function proxy(): string {
  let closure = (): void => {
    let insertRule = CSSStyleSheet.prototype.insertRule;
    CSSStyleSheet.prototype.insertRule = function(style: string, index: number): number {
        let value = insertRule.call(this, style, index);
        window.postMessage({ styleIndex: getStyleIndex(this), style, index }, "*");
        return value;
    };
    function getStyleIndex(sheet: CSSStyleSheet): number {
        for (let i = 0; i < document.styleSheets.length; i++) {
            if (document.styleSheets[i] === sheet) {
                return i;
            }
        }
        return -1;
    }
  };
  return `(${closure.toString()})();`;
}

function upload(data: string): void {
  chrome.runtime.sendMessage({ action: "payload", payload: data }, function(response: any): void {
    if (!(response && response.success)) {
      console.warn("Payload failure, dev tools likely not open.");
    }
  });
}
