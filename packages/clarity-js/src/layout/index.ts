import * as box from "@src/layout/box";
import * as discover from "@src/layout/discover";
import * as doc from "@src/layout/document";
import * as dom from "@src/layout/dom";
import * as mutation from "@src/layout/mutation";
import * as region from "@src/layout/region";

export function start(): void {
    // The order below is important 
    // and is determined by interdependencies of modules
    doc.start();
    region.start();
    dom.start();
    mutation.start();
    discover.start();
    box.start();
}

export function stop(): void {
    region.stop();
    dom.stop();
    mutation.stop();
    box.stop();
    doc.end();
}
