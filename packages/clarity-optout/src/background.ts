chrome.runtime.onStartup.addListener(addCookie);
chrome.runtime.onInstalled.addListener(addCookie);

function addCookie(): void {
    const setDetails: chrome.cookies.SetDetails = {
        domain: "clarity.ms",
        expirationDate: Date.now() + (1000 * 60 * 60 * 24 * 30),
        httpOnly: false,
        name: "coptout",
        path: "/",
        secure: false,
        value: "1",
        url: "http://clarity.ms"
    };

    chrome.cookies.set(setDetails, function(cookie: chrome.cookies.Cookie): void {
        if (cookie) {
            console.log("Setting opt-out cookie succeeded:", setDetails);
        } else {
            console.warn("Setting opt-out cookie failed:", setDetails);
        }
    });
}
