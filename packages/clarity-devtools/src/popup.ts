(function(): void {
    // Initialize configuration
    let state = { showText: true, leanMode : false };
    let showText = (document.getElementById("showText") as HTMLInputElement);
    let leanMode = (document.getElementById("leanMode") as HTMLInputElement);

    // Read from default storage
    chrome.storage.sync.get({clarity: state}, function(items: any): void {
        state = items.clarity;
        redraw(state);
    });

    // Listen for changes
    showText.addEventListener("click", toggle);
    leanMode.addEventListener("click", toggle);

    function toggle(cb: any): void {
        // Update state
        switch (cb.target.id) {
            case "showText":
                state.showText = !state.showText;
                break;
            case "leanMode":
                state.leanMode = !state.leanMode;
                break;
        }

        // Update storage
        chrome.storage.sync.set({clarity: state}, () => {
            redraw(state);
        });
    }

    function redraw(update: any): void {
        showText.checked = update.showText;
        leanMode.checked = update.leanMode;
    }
})();
