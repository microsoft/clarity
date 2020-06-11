import { Event } from "@clarity-types/data";
import { TimelineState } from "@clarity-types/interaction";
import config from "@src/core/config";
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

export function track(time: number, event: Event, target:number, x: number, y: number): void {
    state.push({
        time,
        event: Event.Timeline,
        data: { type: event, target, x, y }
    });
}

export function compute(): void {
    updates = [];
    let max = envelope.data.start + envelope.data.duration;
    let min = Math.max(max - config.timeline, 0);

    for (let s of state) { 
        if (s.time >= min && s.time <= max) {
            updates.push(s);
        }
    }

    encode(Event.Timeline);
}

export function end(): void {
    state = [];
    reset();
}
