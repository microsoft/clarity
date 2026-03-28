import { start as discStart } from "@src/layout/discover";
import { start as docStart, stop as docStop } from "@src/layout/document";
import { start as domStart, stop as domStop } from "@src/layout/dom";
import { start as mutStart, stop as mutStop } from "@src/layout/mutation";
import { start as regStart, stop as regStop } from "@src/layout/region";
import { start as styStart, stop as styStop } from "@src/layout/style";
import { start as animStart, stop as animStop } from "@src/layout/animation";
import { start as custStart, stop as custStop } from "@src/layout/custom";
import { bind } from "@src/core/event";
import config from "@src/core/config";

export { hashText } from "@src/layout/dom";

export function start(): void {
    docStart();
    regStart();
    domStart();
    if (config.delayDom) {
        bind(window, 'load', () => {
            mutStart();
        });
    } else {
        mutStart();
    }
    custStart();
    discStart();
    styStart();
    animStart();
}

export function stop(): void {
    regStop();
    domStop();
    mutStop();
    docStop();
    styStop();
    animStop();
    custStop();
}
