import { Check, Event, Dimension, DimensionData, Setting } from "@clarity-types/data";
import * as limit from "@src/data/limit";
import encode from "./encode";

export let data: DimensionData = null;
export let updates: DimensionData = null;
let limited = false;

export function start(): void {
    data = {};
    updates = {};
    limited = false;
}

export function stop(): void {
    data = {};
    updates = {};
    limited = false;
}

export function log(dimension: Dimension, value: string): void {
    // Check valid value before moving ahead
    if (value) {
        // Ensure received value is casted into a string if it wasn't a string to begin with
        value = `${value}`;
        if (!(dimension in data)) { data[dimension] = []; }
        if (data[dimension].indexOf(value) < 0) {
            // Limit check to ensure we have a cap on number of dimensions we can collect
            if (data[dimension].length > Setting.CollectionLimit) {
                if (!limited) {
                    limited = true;
                    limit.trigger(Check.Collection); 
                }
                return;
            }

            data[dimension].push(value);
            // If this is a new value, track it as part of updates object
            // This allows us to only send back new values in subsequent payloads
            if (!(dimension in updates)) { updates[dimension] = []; }
            updates[dimension].push(value);
        }
    }
}

export function compute(): void {
    encode(Event.Dimension);
}

export function reset(): void {
    updates = {};
    limited = false;
}
