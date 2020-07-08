import { Event } from "@clarity-types/data";
import measure from "@src/core/measure";

export function setTimeout(handler: (event?: Event | boolean) => void, timeout: number, event?: Event): number {
    return window.setTimeout(measure(handler), timeout, event);
}

export function clearTimeout(handle: number): void {
    return window.clearTimeout(handle);
}
