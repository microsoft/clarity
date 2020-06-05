import * as discover from "@src/layout/discover";
import * as doc from "@src/layout/document";
import * as dom from "@src/layout/dom";
import * as mutation from "@src/layout/mutation";
import * as region from "@src/layout/region";

export function start(): void {
    doc.reset();
    dom.start();
    mutation.start();
    discover.start();
    region.reset();
}

export function end(): void {
    dom.end();
    mutation.end();
    region.reset();
    doc.reset();
}
