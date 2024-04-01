import * as discover from "@src/layout/discover";
import * as doc from "@src/layout/document";
import * as dom from "@src/layout/dom";
import * as mutation from "@src/layout/mutation";
import * as region from "@src/layout/region";
import * as style from "@src/layout/style";
import * as animation from "@src/layout/animation";
import { bind } from "@src/core/event";
import config from "@src/core/config";

export { hashText } from "@src/layout/dom";

export function start(): void {
    // The order below is important 
    // and is determined by interdependencies of modules
    doc.start();
    region.start();
    dom.start();
    if (config.delayDom) {
        // Lazy load layout module as part of page load time performance improvements experiment 
        bind(window, 'load', () => {
            mutation.start();
        });
    }
    discover.start();
    style.start();
    animation.start();
}

export function stop(): void {
    region.stop();
    dom.stop();
    mutation.stop();
    doc.stop();
    style.stop();
    animation.stop();
}
