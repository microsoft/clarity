import { Constant, Event, UpgradeData } from "@clarity-types/data";
import config from "@src/core/config";
import encode from "@src/data/encode";

export let data: UpgradeData = null;

export function start(): void {
    data = null;
}

// Following call will upgrade the session from lean mode into the full mode retroactively from the start of the page.
// As part of the lean mode, we do not send back any layout information - including discovery of DOM and mutations.
// However, if there's a need for full fidelity playback, calling this function will disable lean mode
// and send all backed up layout events to the server.
export function upgrade(key: string): void {
    if (config.lean) {
        config.lean = false;
        data = { key };

        // If tracking is enabled, persist the setting in session storage
        if (config.track && sessionStorage) {
            sessionStorage.setItem(Constant.UpgradeKey, `1`);
        }

        encode(Event.Upgrade);
    }
}

export function stop(): void {
    data = null;
}
