import { Metric } from "@clarity-types/data";
import { StyleSheetState } from "@clarity-types/layout";
import * as core from "@src/core";
import * as metric from "@src/data/metric";

export let state: StyleSheetState[] = [];
let replace: (text?: string) => Promise<CSSStyleSheet> = null;
let replaceSync: (text?: string) => void = null;

export function start(): void {
    reset();

    if (replace === null) { 
        replace = CSSStyleSheet.prototype.replace; 
        CSSStyleSheet.prototype.replace = function(): Promise<CSSStyleSheet> {
            if (core.active()) {
                metric.max(Metric.ConstructedStyles, 1);
            }
            return replace.apply(this, arguments);
        };
    }

    if (replaceSync === null) { 
        replaceSync = CSSStyleSheet.prototype.replaceSync; 
        CSSStyleSheet.prototype.replaceSync = function(): void {
            if (core.active()) {
                metric.max(Metric.ConstructedStyles, 1);
            }
            return replaceSync.apply(this, arguments);
        };
    }
}

export function checkDocumentStyles(documentNode: Document): void {
    if (!documentNode?.adoptedStyleSheets) {
        // if we don't have adoptedStyledSheets on the Node passed to us, we can short circuit.
        return;
    }   
    metric.max(Metric.ConstructedStyles, 1);
}

export function compute(): void {
    checkDocumentStyles(document);
}

export function reset(): void {
    state = [];
}

export function stop(): void {
    reset();
}
