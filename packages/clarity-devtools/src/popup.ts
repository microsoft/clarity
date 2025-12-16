async function init(): Promise<void> {
    let state = { showText: true, leanMode : false };
    let showText = (document.getElementById("showText") as HTMLInputElement);
    let leanMode = (document.getElementById("leanMode") as HTMLInputElement);

    if (!showText || !leanMode) {
        console.error('[Clarity DevTools] Popup: DOM elements not found');
        return;
    }

    try {
        const items = await chrome.storage.sync.get({clarity: state});
        state = items.clarity;
        redraw(state);
    } catch (error) {
        console.error('[Clarity DevTools] Popup: Error loading settings:', error);
    }

    showText.addEventListener("click", toggle);
    leanMode.addEventListener("click", toggle);

    async function toggle(cb: any): Promise<void> {
        switch (cb.target.id) {
            case "showText":
                state.showText = !state.showText;
                break;
            case "leanMode":
                state.leanMode = !state.leanMode;
                break;
        }

        try {
            await chrome.storage.sync.set({clarity: state});
            redraw(state);
        } catch (error) {
            console.error('[Clarity DevTools] Popup: Error saving settings:', error);
        }
    }

    function redraw(update: any): void {
        showText.checked = update.showText;
        leanMode.checked = update.leanMode;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
