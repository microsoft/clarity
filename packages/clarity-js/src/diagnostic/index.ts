import * as image from "./image";
import * as log from "./log";
import * as script from "./script";

export function start(): void {
    script.start();
    image.start();
    log.reset();
}

export function stop(): void {
    image.stop();
    log.reset();
}
