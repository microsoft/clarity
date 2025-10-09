import config from "./config";

chrome.runtime.onMessage.addListener(function(message: any): void {
  if (message.action === "activate") {
    activate();
  } else if (message.action === "warn") {
    console.warn(message.message);
  }
});

chrome.runtime.sendMessage({ action: "activate" }, function(response: any): void {
  // Check for errors (e.g., service worker not available)
  if (chrome.runtime.lastError) {
    // Service worker might not be ready yet, that's okay
    return;
  }
  if (response && response.success) {
    activate();
  }
});

function activate(): void {
  setup(chrome.runtime.getURL('clarity.js'));
}

function setup(url: string): void {
  // Execute script in the webpage context
  let script = document.createElement("script");
  script.setAttribute('type', 'text/javascript');
  script.setAttribute('src', url);
  document.body.appendChild(script);
  
  window.addEventListener("message", function(event: MessageEvent): void {
      if (event.source === window && event.data.action) {
        switch (event.data.action) {
          case "wireup":
            chrome.storage.sync.get({ clarity: { showText: true, leanMode: false } }, (items: any) => {
              let c = config();
              let settings = {
                lean: items.clarity.leanMode,
                regions: c.regions,
                fraud: c.fraud,
                mask: c.mask,
                unmask: c.unmask,
                drop: c.drop,
                content: items.clarity.showText,
                projectId: "devtools"
              };
              // Send configuration to clarity.js via postMessage (no inline script needed)
              // Note: upload callback will be set by clarity.js itself
              window.postMessage({ action: "clarity-start", settings: settings }, "*");
            });
            break;
          case "upload":
            upload(event.data.payload);
            break;
        }
      }
  });

  
}

function upload(data: string): void {
  chrome.runtime.sendMessage({ action: "payload", payload: data }, function(response: any): void {
    // Check for errors (e.g., service worker not available)
    if (chrome.runtime.lastError) {
      console.warn("Background service worker not available:", chrome.runtime.lastError.message);
      return;
    }
    if (!(response && response.success)) {
      console.warn("Payload failure, dev tools likely not open.");
    }
  });
}
