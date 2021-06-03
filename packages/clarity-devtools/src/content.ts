import { clarity, Layout } from "clarity-js";
import config from "./config";

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
      let c = config();
      clarity.start({
        delay: 500,
        lean: items.clarity.leanMode,
        regions: c.regions,
        metrics: c.metrics,
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
      if (event.source === window && event.data.api) {
          let d = event.data;
          switch (d.api) {
            case "insertRule":
              if (d.styleIndex >= 0) {
                const sheet = document.styleSheets[d.styleIndex] as CSSStyleSheet;
                if (sheet && sheet.cssRules) {
                  // Posting messages across different context is an asynchronous operation
                  // And it's possible that by the time message is received, stylesheets may have been added or removed
                  // invalidating the style index. In that case, as a work around, we ignore the rule index property.
                  // This edge case is restricted to the use of this extension and won't impact production use of the script.
                  if (sheet.cssRules.length > d.index) {
                    sheet.insertRule(d.style, d.index);
                  } else { sheet.insertRule(d.style); }
                } else { console.warn(`Clarity: Style not found at ${d.styleIndex}.`); }
              }
              break;
            case "pushState":
              history.pushState(d.state, d.title, d.url);
              break;
            case "replaceState":
              history.replaceState(d.state, d.title, d.url);
              break;
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
    let pushState = history.pushState;
    history.pushState = function(state: any, title: string, url?: string): void {
        pushState.apply(this, arguments);
        window.postMessage({ api: "pushState", state: JSON.stringify(state), title, url }, "*");
    };
    
    let replaceState = history.replaceState;
    history.replaceState = function(state: any, title: string, url?: string): void {
        replaceState.apply(this, arguments);
        window.postMessage({ api: "replaceState", state: JSON.stringify(state), title, url }, "*");
    };

    let insertRule = CSSStyleSheet.prototype.insertRule;
    CSSStyleSheet.prototype.insertRule = function(style: string, index: number): number {
        window.postMessage({ api: "insertRule", styleIndex: getStyleIndex(this), style, index }, "*");
        return insertRule.apply(this, arguments);
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
