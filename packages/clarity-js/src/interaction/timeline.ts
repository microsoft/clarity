import { BooleanFlag, Event } from "@clarity-types/data";
import { BrowsingContext, Setting, TimelineState } from "@clarity-types/interaction";
import * as baseline from "@src/data/baseline";
import * as envelope from "@src/data/envelope";
import encode from "@src/interaction/encode";

let state: TimelineState[] = [];
export let updates: TimelineState[] = [];

export function start(): void {
    state = [];
    reset();
}

export function reset(): void {
    updates = [];
}

export function track(time: number,
    event: Event,
    hash: string,
    x: number,
    y: number,
    reaction: number = BooleanFlag.True,
    context: number = BrowsingContext.Self): void {
    state.push({
        time,
        event: Event.Timeline,
        data: {
            type: event,
            hash,
            x,
            y,
            reaction,
            context
        }
    });

    // Since timeline only keeps the data for configured time, we still want to continue tracking these values
    // as part of the baseline. For instance, in a scenario where last scroll happened 5s ago.
    // We would still need to capture the last scroll position as part of the baseline event, even when timeline will be empty.
    baseline.track(event, x, y);
}

export function compute(): void {
    const temp = [];
    updates = [];
    let max = envelope.data.start + envelope.data.duration;
    let min = Math.max(max - Setting.TimelineSpan, 0);

    for (let s of state) {
        if (s.time >= min) {
            if (s.time <= max) { updates.push(s); }
            temp.push(s);
        }
    }

    state = temp; // Drop events less than the min time
    encode(Event.Timeline);
}

export function stop(): void {
    state = [];
    reset();
}
