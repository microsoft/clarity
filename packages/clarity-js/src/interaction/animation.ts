import { Event } from "@clarity-types/data";
import { AnimationOperation, AnimationState } from "@clarity-types/layout";
import encode from "@src/interaction/encode";

export let state: AnimationState[] = [];

export function start(): void {
    reset();
}

export function reset(): void {
    state = [];
}

export function track(time: number, id: string, operation: AnimationOperation): void {
    state.push({
        time,
        event: Event.Animation,
        data: {
            id,
            operation
        }
    });

    encode(Event.Animation);
}

export function stop(): void {
    state = [];
    reset();
}
