let connections: any[] = [];

chrome.runtime.onConnect.addListener(function(port: chrome.runtime.Port): void {

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
