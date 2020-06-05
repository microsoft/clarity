import { Event, Dimension, DimensionData } from "@clarity-types/data";
import encode from "./encode";

export let data: DimensionData = null;
export let updates: Dimension[] = [];

export function start(): void {
    data = {};
}

export function end(): void {
    data = {};
}

export function log(dimension: Dimension, value: string): void {
    if (!(dimension in data)) { data[dimension] = []; }
    data[dimension].push(value);
    track(dimension);
}

export function compute(): void {
    encode(Event.Dimension);
}

function track(dimension: Dimension): void {
    if (updates.indexOf(dimension) === -1) {
        updates.push(dimension);
    }
}

export function reset(): void {
    updates = [];
}
