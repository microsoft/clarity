import { Event, Dimension, DimensionData } from "@clarity-types/data";
import encode from "./encode";

export let data: DimensionData = null;
export let updates: DimensionData = null;

export function start(): void {
    data = {};
    updates = {};
}

export function end(): void {
    data = {};
    updates = {};
}

export function log(dimension: Dimension, value: string): void {
    if (!(dimension in data)) { data[dimension] = []; }
    if (data[dimension].indexOf(value) < 0) {
        data[dimension].push(value);
        // If this is a new value, track it as part of updates object
        // This allows us to only send back new values in subsequent payloads
        if (!(dimension in updates)) { updates[dimension] = []; }
        updates[dimension].push(value);
    }
}

export function compute(): void {
    encode(Event.Dimension);
}

export function reset(): void {
    updates = {};
}
