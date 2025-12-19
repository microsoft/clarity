import config from "./config";

let isActivated = false;
let messageListener: ((event: MessageEvent) => void) | null = null;

chrome.runtime.onMessage.addListener(function(message: { action: string; message?: string }): void {
  if (message.action === "activate") {
    console.log('[Clarity DevTools] Content: Received activate message from background');
    activate();
  } else if (message.action === "warn") {
    console.warn(message.message);
  }
});

(async function initializeContentScript(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ action: "activate" });
    console.log('[Clarity DevTools] Content: Initialization check, DevTools connected:', response?.success);
    if (response?.success) {
      console.log('[Clarity DevTools] Content: Activating immediately (DevTools already open)');
      activate();
    } else {
      console.log('[Clarity DevTools] Content: Waiting for DevTools to open...');
    }
  } catch (error) {
    if (chrome.runtime?.lastError || !chrome.runtime?.id) {
      console.log('[Clarity DevTools] Content: Extension context invalidated');
    } else {
      console.error('[Clarity DevTools] Content: Error during initialization:', error);
    }
  }
})();

async function activate(): Promise<void> {
  if (isActivated) {
    console.log('[Clarity DevTools] Content: Already activated, skipping');
    return;
  }
  
  // Set flag immediately to prevent race condition
  isActivated = true;
  console.log('[Clarity DevTools] Content: Activating Clarity tracking...');

  if (document.body) {
    if (!setup(chrome.runtime.getURL('clarity.js'))) {
      isActivated = false; // Reset if setup fails
      console.error('[Clarity DevTools] Content: Clarity activation failed');
    } else {
      console.log('[Clarity DevTools] Content: Clarity activated successfully');
    }
  } else {
    if (document.readyState === 'loading') {
      await new Promise<void>(resolve => {
        document.addEventListener('DOMContentLoaded', () => {
          if (!setup(chrome.runtime.getURL('clarity.js'))) {
            isActivated = false; // Reset if setup fails
          }
          resolve();
        }, { once: true });
      });
    } else {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!setup(chrome.runtime.getURL('clarity.js'))) {
        isActivated = false; // Reset if setup fails
      }
    }
  }
}

function setup(url: string): boolean {
  if (!document.body) {
    console.error('[Clarity DevTools] Content: document.body not available, setup failed');
    return false;
  }
  
  // Only set up once - if already set up, return success
  if (messageListener) {
    console.log('[Clarity DevTools] Content: Message listener already registered, skipping setup');
    return true;
  }
  
  const script = document.createElement("script");
  script.setAttribute('type', 'text/javascript');
  script.setAttribute('src', url);
  document.body.appendChild(script);
  
  messageListener = function(event: MessageEvent): void {
      if (event.source === window && event.data?.action) {
        switch (event.data.action) {
          case "wireup":
            (async () => {
              try {
                const items = await chrome.storage.sync.get({ clarity: { showText: true, leanMode: false } });
                const cfg = config();
                const settings = {
                  regions: cfg.regions,
                  fraud: cfg.fraud,
                  mask: cfg.mask,
                  unmask: cfg.unmask,
                  drop: cfg.drop,
                  showText: items.clarity.showText,
                  leanMode: items.clarity.leanMode
                };
                window.dispatchEvent(new CustomEvent('clarity-devtools-settings', { detail: settings }));
              } catch (error) {
                console.error('[Clarity DevTools] Content: Error loading settings:', error);
              }
            })();
            break;
          case "upload":
            upload(event.data.payload);
            break;
        }
      }
  };
  
  window.addEventListener("message", messageListener);
  return true;
}

async function upload(data: string): Promise<void> {
  if (!chrome.runtime?.id) {
    console.log('[Clarity DevTools] Content: Extension context invalidated, skipping upload');
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({ action: "payload", payload: data });
    if (!(response && response.success)) {
      console.debug('[Clarity DevTools] Content: DevTools panel not connected, payload not forwarded');
    }
  } catch (error) {
    if (chrome.runtime?.lastError || !chrome.runtime?.id) {
      console.log('[Clarity DevTools] Content: Extension context invalidated');
    } else {
      console.error('[Clarity DevTools] Content: Error uploading payload:', error);
    }
  }
}
