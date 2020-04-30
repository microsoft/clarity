import * as boxmodel from "@src/layout/boxmodel";
import * as discover from "@src/layout/discover";
import * as doc from "@src/layout/document";
import * as dom from "@src/layout/dom";
import * as mutation from "@src/layout/mutation";

export function start(): void {
    doc.reset();
    dom.start();
    mutation.start();
    discover.start();
    boxmodel.reset();
}

export function end(): void {
    dom.end();
    mutation.end();
    boxmodel.reset();
    doc.reset();
}
