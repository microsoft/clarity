import * as image from "./image";
import * as internal from "./internal";
import * as script from "./script";

export function start(): void {
    script.start();
    image.start();
    internal.start();
}

export function stop(): void {
    image.stop();
    internal.stop();
}
