import { start as chgStart, stop as chgStop, observe as chgObs } from "@src/interaction/change";
import { start as clkStart, stop as clkStop, observe as clkObs } from "@src/interaction/click";
import { start as cbStart, stop as cbStop, observe as cbObs } from "@src/interaction/clipboard";
import { start as inpStart, stop as inpStop, observe as inpObs } from "@src/interaction/input";
import { start as ptrStart, stop as ptrStop, observe as ptrObs } from "@src/interaction/pointer";
import { start as resStart, stop as resStop } from "@src/interaction/resize";
import { start as scrStart, stop as scrStop, observe as scrObs } from "@src/interaction/scroll";
import { start as selStart, stop as selStop, observe as selObs } from "@src/interaction/selection";
import { start as subStart, stop as subStop, observe as subObs } from "@src/interaction/submit";
import { start as tlStart, stop as tlStop } from "@src/interaction/timeline";
import { start as unlStart, stop as unlStop } from "@src/interaction/unload";
import { start as visStart, stop as visStop } from "@src/interaction/visibility";
import { start as focStart, stop as focStop } from "@src/interaction/focus";
import { start as pgStart, stop as pgStop } from "@src/interaction/pageshow";

export function start(): void {
    tlStart();
    clkStart();
    cbStart();
    ptrStart();
    inpStart();
    resStart();
    visStart();
    focStart();
    pgStart();
    scrStart();
    selStart();
    chgStart();
    subStart();
    unlStart();
}

export function stop(): void {
    tlStop();
    clkStop();
    cbStop();
    ptrStop();
    inpStop();
    resStop();
    visStop();
    focStop();
    pgStop();
    scrStop();
    selStop();
    chgStop();
    subStop();
    unlStop();
}

export function observe(root: Node): void {
    scrObs(root);
    // Only monitor following interactions if the root node is a document.
    // In case of shadow DOM, following events automatically bubble up to the parent document.
    if (root.nodeType === Node.DOCUMENT_NODE) {
        clkObs(root);
        cbObs(root);
        ptrObs(root);
        inpObs(root);
        selObs(root);
        chgObs(root);
        subObs(root);
    }
}
