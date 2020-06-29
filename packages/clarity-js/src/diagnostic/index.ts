import * as image from "@src/diagnostic/image";
import * as internal from "@src/diagnostic/internal";
import * as script from "@src/diagnostic/script";

export function start(): void {
    script.start();
    image.start();
    internal.reset();
}

export function end(): void {
    image.end();
    internal.reset();
}
