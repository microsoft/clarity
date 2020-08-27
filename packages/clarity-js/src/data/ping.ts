import { Event, PingData, Setting } from "@clarity-types/data";
import { suspend } from "@src/core";
import { time } from "@src/core/time";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import encode from "./encode";

export let data: PingData;
let last = 0;
let interval = 0;
let timeout: number = null;

export function start(): void {
    interval = Setting.PingInterval;
    last = 0;
}

export function reset(): void {
    if (timeout) { clearTimeout(timeout); }
    timeout = setTimeout(ping, interval);
    last = time();
}

function ping(): void {
    let now = time();
    data = { gap: now - last };
    encode(Event.Ping);
    if (data.gap < Setting.PingTimeout) {
        timeout = setTimeout(ping, interval);
    } else { suspend(); }
}

export function stop(): void {
    clearTimeout(timeout);
    last = 0;
    interval = 0;
}
