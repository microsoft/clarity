let connections: any[] = [];
let keepAliveIntervals: Map<chrome.runtime.Port, ReturnType<typeof setInterval>> = new Map();

chrome.runtime.onConnect.addListener(function(port: chrome.runtime.Port): void {
    // Keep service worker alive with periodic messages
    const keepAliveInterval = setInterval(() => {
        if (port) {
            port.postMessage({ action: "keepalive" });
        }
    }, 25000); // Every 25 seconds to stay within the 30 second timeout

    keepAliveIntervals.set(port, keepAliveInterval);

    let listener = function(message: any): void {
        // Store a reference to tabId of the devtools page and send a message to activate Clarity
        if (message.action === "init") {
          connections[message.tabId] = port;
          chrome.tabs.sendMessage(message.tabId, {action: "activate"});
          return;
        } else if (message.action === "warn") {
          chrome.tabs.sendMessage(message.tabId, {action: "warn", message: message.message});
          return;
        }
    };

    // Listen to messages sent from the devtools page
    port.onMessage.addListener(listener);

    port.onDisconnect.addListener(function(): void {
        // Clear keep-alive interval on disconnect
        const interval = keepAliveIntervals.get(port);
        if (interval) {
            clearInterval(interval);
            keepAliveIntervals.delete(port);
        }

        port.onMessage.removeListener(listener);
        let tabs = Object.keys(connections);
        for (let tab of tabs) {
          if (connections[tab] === port) {
            delete connections[tab];
            break;
          }
        }
    });
});

// Receive message from content script and relay it to the devtools page
chrome.runtime.onMessage.addListener(
    function(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void): boolean {
        switch (message.action) {
          case "activate":
            if (sender.tab) {
              let tabId = sender.tab.id;
              let success = tabId in connections;
              let icon = success ? "icon-activated.png" : "icon.png";
              let title = success ? "Microsoft Clarity Developer Tools" : "Microsoft Clarity: Open developer tools to activate";
              chrome.action.setIcon({ path: icon, tabId });
              chrome.action.setTitle({ title, tabId });
              sendResponse({ success });
            }
            break;
          case "payload":
            if (sender.tab) {
              let tabId = sender.tab.id;
              let success = tabId in connections;
              if (success) {
                connections[tabId].postMessage(message);
              }
              sendResponse({ success });
            }
            break;
        }
        // Return true to indicate we'll send a response (keeps the message channel open)
        return true;
    }
);
