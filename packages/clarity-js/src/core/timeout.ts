import { Event } from "@clarity-types/data";
import measure from "./measure";

export function setTimeout(handler: (event?: Event | boolean) => void, timeout?: number, event?: Event): number {
    return window.setTimeout(() => measure(handler)(event), timeout);
}

export function clearTimeout(handle: number): void {
    return window.clearTimeout(handle);
}
