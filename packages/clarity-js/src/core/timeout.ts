import { Event } from "@clarity-types/data";
import measure from "./measure";

export function setTimeout(handler: (event?: Event | boolean) => void, timeout?: number, event?: Event): number {
    var x = window.setTimeout(measure(handler), timeout, event);
    // TODO (samart): nothing seeming very interseting here, lots of timeouts set and cancelled
    //console.log(`calling setTimeout for ${event} with value ${timeout} and return ${x}`);
    return x;
}

export function clearTimeout(handle: number): void {
    //console.log(`clearing ${handle}`);
    return window.clearTimeout(handle);
}
