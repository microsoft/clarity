import { Event, PingData } from "@clarity-types/data";
import { suspend } from "@src/clarity";
import config from "@src/core/config";
import { time } from "@src/core/time";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import encode from "./encode";

export let data: PingData;
let last = 0;
let interval = 0;
let timeout: number = null;

export function start(): void {
    interval = config.ping;
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
    if (data.gap < config.timeout) {
        timeout = setTimeout(ping, interval);
    } else { suspend(); }
}

export function end(): void {
    clearTimeout(timeout);
    last = 0;
    interval = 0;
}
