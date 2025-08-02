import * as change from "@src/interaction/change";
import * as click from "@src/interaction/click";
import * as clipboard from "@src/interaction/clipboard";
import * as input from "@src/interaction/input";
import * as pointer from "@src/interaction/pointer";
import * as resize from "@src/interaction/resize";
import * as scroll from "@src/interaction/scroll";
import * as selection from "@src/interaction/selection";
import * as submit from "@src/interaction/submit";
import * as timeline from "@src/interaction/timeline";
import * as unload from "@src/interaction/unload";
import * as visibility from "@src/interaction/visibility";

export function start(): void {
    timeline.start();
    click.start();
    clipboard.start();
    pointer.start();
    input.start();
    resize.start();
    visibility.start();
    scroll.start();
    selection.start();
    change.start();
    submit.start();
    unload.start();
}

export function stop(): void {
    timeline.stop();
    click.stop();
    clipboard.stop();
    pointer.stop();
    input.stop();
    resize.stop();
    visibility.stop();
    scroll.stop();
    selection.stop();
    change.stop();
    submit.stop();
    unload.stop()
}

export function observe(root: Node): void {
    scroll.observe(root);
    // Only monitor following interactions if the root node is a document
    // In case of shadow DOM, following events automatically bubble up to the parent document.
    if (root.nodeType === Node.DOCUMENT_NODE) {
        click.observe(root);
        clipboard.observe(root);
        pointer.observe(root);
        input.observe(root);
        selection.observe(root);
        change.observe(root);
        submit.observe(root);
    }
}
