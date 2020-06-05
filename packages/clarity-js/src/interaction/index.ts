import * as baseline from "@src/interaction/baseline";
import * as click from "@src/interaction/click";
import * as input from "@src/interaction/input";
import * as pointer from "@src/interaction/pointer";
import * as resize from "@src/interaction/resize";
import * as scroll from "@src/interaction/scroll";
import * as selection from "@src/interaction/selection";
import * as unload from "@src/interaction/unload";
import * as visibility from "@src/interaction/visibility";

export function start(): void {
    baseline.start();
    click.start();
    pointer.start();
    input.start();
    resize.start();
    visibility.start();
    scroll.start();
    selection.start();
    unload.start();
}

export function end(): void {
    baseline.end();
    click.end();
    pointer.end();
    input.end();
    resize.end();
    visibility.end();
    scroll.end();
    selection.end();
    unload.end()
}

export function observe(root: Node): void {
    scroll.observe(root);
    // Only monitor following interactions if the root node is a document
    // In case of shadow DOM, following events automatically bubble up to the parent document.
    if (root.nodeType === Node.DOCUMENT_NODE) {
        click.observe(root);
        pointer.observe(root);
        input.observe(root);
        selection.observe(root);
    }
}