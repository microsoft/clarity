import { Constant, Event, UpgradeData } from "@clarity-types/data";
import * as core from "@src/core";
import config from "@src/core/config";
import encode from "@src/data/encode";
import * as metadata from "@src/data/metadata";

export let data: UpgradeData = null;

export function start(): void {
    if (!config.lean && config.upgrade) { config.upgrade(Constant.Config); }
    data = null;
}

// Following call will upgrade the session from lean mode into the full mode retroactively from the start of the page.
// As part of the lean mode, we do not send back any layout information - including discovery of DOM and mutations.
// However, if there's a need for full fidelity playback, calling this function will disable lean mode
// and send all backed up layout events to the server.
export function upgrade(key: string): void {
    // Upgrade only if Clarity was successfully activated on the page
    if (core.active() && config.lean) {
        config.lean = false;
        data = { key };

        // Update metadata to track we have upgraded this session
        metadata.save();

        // Callback upgrade handler, if configured
        if (config.upgrade) { config.upgrade(key); }

        encode(Event.Upgrade);
    }
}

export function stop(): void {
    data = null;
}
