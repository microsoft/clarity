const connections = new Map<number, chrome.runtime.Port>();

chrome.runtime.onConnect.addListener(function(port: chrome.runtime.Port): void {

    const listener = function(message: { action: string; tabId?: number; message?: string }): void {
        if (message.action === "init" && typeof message.tabId === 'number') {
          console.log('[Clarity DevTools] Background: Init received for tab', message.tabId, '- Connection established');
          connections.set(message.tabId, port);
          console.log('[Clarity DevTools] Background: Active connections:', Array.from(connections.keys()));
          chrome.tabs.sendMessage(message.tabId, {action: "activate"}).then(() => {
            console.log('[Clarity DevTools] Background: Activate message sent to tab', message.tabId);
          }).catch((error) => {
            console.warn('[Clarity DevTools] Background: Failed to send activate message', error);
          });
          return;
        } else if (message.action === "warn" && typeof message.tabId === 'number') {
          chrome.tabs.sendMessage(message.tabId, {action: "warn", message: message.message}).catch(() => {
            // Tab might not be ready yet, ignore error
          });
          return;
        }
    };

    port.onMessage.addListener(listener);

    port.onDisconnect.addListener(function(): void {
        port.onMessage.removeListener(listener);
        connections.forEach((connectedPort, tabId) => {
          if (connectedPort === port) {
            connections.delete(tabId);
            console.log('[Clarity DevTools] Background: Disconnected tab', tabId);
          }
        });
    });
});

chrome.runtime.onMessage.addListener(
    function(message: { action: string; payload?: string }, sender: chrome.runtime.MessageSender, sendResponse: (response: { success: boolean }) => void): boolean {
        (async () => {
            try {
                if (!message || !message.action) {
                    sendResponse({ success: false });
                    return;
                }

                switch (message.action) {
                  case "activate":
                    if (sender.tab?.id) {
                      const tabId = sender.tab.id;
                      const success = connections.has(tabId);
                      console.log('[Clarity DevTools] Background: Activate request from tab', tabId, 'connected:', success);
                      const icon = success ? "icon-activated.png" : "icon.png";
                      const title = success ? "Microsoft Clarity Developer Tools" : "Microsoft Clarity: Open developer tools to activate";
                      try {
                        await Promise.all([
                          chrome.action.setIcon({ path: icon, tabId }),
                          chrome.action.setTitle({ title, tabId })
                        ]);
                        console.log('[Clarity DevTools] Background: Responding with success:', success);
                        sendResponse({ success });
                      } catch (error) {
                        console.warn('[Clarity DevTools] Background: Error setting icon/title', error);
                        sendResponse({ success: false });
                      }
                    } else {
                      sendResponse({ success: false });
                    }
                    break;
                  case "payload":
                    if (sender.tab?.id) {
                      const tabId = sender.tab.id;
                      const success = connections.has(tabId);
                      if (!success) {
                        console.log('[Clarity DevTools] Background: Payload for tab', tabId, 'not connected. Active connections:', Array.from(connections.keys()));
                      }
                      if (success) {
                        const port = connections.get(tabId);
                        port?.postMessage(message);
                      }
                      sendResponse({ success });
                    } else {
                      sendResponse({ success: false });
                    }
                    break;
                  default:
                    sendResponse({ success: false });
                    break;
                }
            } catch (error) {
                console.error('[Clarity DevTools] Background: Error handling message:', error);
                sendResponse({ success: false });
            }
        })();
        return true;
    }
);
