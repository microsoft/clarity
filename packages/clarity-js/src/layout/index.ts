import * as discover from "@src/layout/discover";
import * as doc from "@src/layout/document";
import * as dom from "@src/layout/dom";
import * as mutation from "@src/layout/mutation";
import * as region from "@src/layout/region";
import * as adoptedStyles from "@src/layout/adoptedStyles";
import * as animation from "@src/layout/animation";

export { hashText } from "@src/layout/dom";

export function start(): void {
    // The order below is important 
    // and is determined by interdependencies of modules
    doc.start();
    region.start();
    dom.start();
    mutation.start();
    discover.start();
    adoptedStyles.start();
    animation.start();
}

export function stop(): void {
    region.stop();
    dom.stop();
    mutation.stop();
    doc.stop();
    adoptedStyles.stop();
    animation.stop();
}
