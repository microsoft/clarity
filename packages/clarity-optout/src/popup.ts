(function(): void {
    // Initialize configuration
    let state = { optOut: true };
    let optOut = (document.getElementById("optOut") as HTMLInputElement);

    // Read from default storage
    chrome.storage.sync.get({clarity: state}, function(items: any): void {
        state = items.clarity;
        redraw(state);
    });

    // Listen for changes
    optOut.addEventListener("click", toggle);

    function toggle(cb: any): void {
        // Update state
        switch (cb.target.id) {
            case "optOut":
                state.optOut = !state.optOut;
                break;
        }

        // Update storage
        chrome.storage.sync.set({clarity: state}, () => {
            redraw(state);
        });
    }

    function redraw(update: any): void {
        optOut.checked = update.optOut;
    }
})();
