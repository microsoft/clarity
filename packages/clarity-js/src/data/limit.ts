import { Check, Event, LimitData, Setting } from "@clarity-types/data";
import * as clarity from "@src/clarity";
import { time } from "@src/core/time";
import * as envelope from "@src/data/envelope";
import * as metadata from "@src/data/metadata";
import encode from "./encode";

export let data: LimitData;

export function start(): void {
    data = { check: Check.None };
}

export function check(bytes: number): void {
    if (data.check === Check.None) {
        let reason = data.check;
        reason = envelope.data.sequence >= Setting.PayloadLimit ? Check.Payload : reason;
        reason = envelope.data.pageNum >= Setting.PageLimit ? Check.Page : reason;
        reason = time() > Setting.ShutdownLimit ? Check.Shutdown : reason;
        reason = bytes > Setting.PlaybackBytesLimit ? Check.Shutdown : reason;
        if (reason !== data.check) {
            trigger(reason);
        }
    }
}

export function trigger(reason: Check): void {
    data.check = reason;
    // limit the dimensions we collect, but we don't need to stop Clarity entirely if we hit the limit
    if (reason !== Check.Collection) {
        metadata.clear();
        clarity.stop();
    }
}

export function compute(): void {
    if (data.check !== Check.None) {
        encode(Event.Limit);
    }
}

export function stop(): void {
    data = null;
}
