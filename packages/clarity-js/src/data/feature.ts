import { Event, Feature, FeatureData } from "@clarity-types/data";
import encode from "./encode";

export let data: FeatureData = null;
export let updates: Feature[] = [];

export function start(): void {
    data = {};
}

export function end(): void {
    data = {};
}

export function log(feature: Feature, value: string): void {
    if (!(feature in data)) { data[feature] = []; }
    data[feature].push(value);
    track(feature);
}

export function compute(): void {
    encode(Event.Feature);
}

function track(feature: Feature): void {
    if (updates.indexOf(feature) === -1) {
        updates.push(feature);
    }
}

export function reset(): void {
    updates = [];
}
