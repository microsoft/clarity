import * as image from "./image";
import * as log from "./log";
import * as script from "./script";

export function start(): void {
    script.start();
    image.start();
    log.reset();
}

export function end(): void {
    image.end();
    log.reset();
}
