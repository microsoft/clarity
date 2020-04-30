import { Event, UpgradeData } from "@clarity-types/data";
import config from "@src/core/config";
import encode from "@src/data/encode";

export let data: UpgradeData = null;

export function reset(): void {
    data = null;
}

// Following call will upgrade the session from lean mode into the full mode retroactively from the start of the page.
// As part of the lean mode, we do not send back any layout information - including discovery of DOM and mutations.
// However, if there's a need for full fidelity playback, calling this function will disable lean mode
// and send all backed up layout events to the server.
export function upgrade(key: string): void {
    config.lean = false;
    data = { key };
    encode(Event.Upgrade);
}
