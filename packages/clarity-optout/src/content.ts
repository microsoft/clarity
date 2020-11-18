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
    chrome.storage.sync.get({
        clarity: { optOut: true }
    }, (items: any) => {
        window["coptout"] = items.clarity.optOut;
    });
}
