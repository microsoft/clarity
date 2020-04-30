import * as image from "./image";
import * as internal from "./internal";
import * as script from "./script";

export function start(): void {
    script.start();
    image.start();
    internal.reset();
}

export function end(): void {
    image.end();
    internal.reset();
}
