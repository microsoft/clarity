import { Event } from "@clarity-types/data";
import { StyleSheetOperation, StyleSheetState } from "@clarity-types/layout";
import { time } from "@src/core/time";
import { shortid, data as metadataFields } from "@src/data/metadata";
import encode from "@src/layout/encode";
import { getId, getNode } from "@src/layout/dom";
import * as core from "@src/core";
import { getCssRules } from "./node";

export let state: StyleSheetState[] = [];
let replace: (text?: string) => Promise<CSSStyleSheet> = null;
let replaceSync: (text?: string) => void = null;
const styleSheetId = 'claritySheetId';
const styleSheetPageNum = 'claritySheetId';
let styleSheetMap = {};

// TODO (samart): for some reason we seem to be getting a lot of duplicate style sheets here, 10s of thousands
// might need to do something to hash the contents of a style sheet and reference that
// or could be that my pagenum logic doesnt work right
export function start(): void {
    reset();

    if (replace === null) { 
        replace = CSSStyleSheet.prototype.replace; 
        CSSStyleSheet.prototype.replace = function(): Promise<CSSStyleSheet> {
            if (core.active()) {
                bootStrapStyleSheet(this);
                trackStyleChange(time(), this[styleSheetId], StyleSheetOperation.Replace, arguments[0]);
            }
            return replace.apply(this, arguments);
        };
    }

    if (replaceSync === null) { 
        replaceSync = CSSStyleSheet.prototype.replaceSync; 
        CSSStyleSheet.prototype.replaceSync = function(): void {
            if (core.active()) {
                bootStrapStyleSheet(this);
                trackStyleChange(time(), this[styleSheetId], StyleSheetOperation.ReplaceSync, arguments[0]);
            }
            return replaceSync.apply(this, arguments);
        };
    }
}

function bootStrapStyleSheet(styleSheet: CSSStyleSheet): void {
    // If we haven't seen this style sheet on this page yet, we create a reference to it for the visualizer.
    // For SPA or times in which Clarity restarts on a given page, our visualizer would lose context
    // on the previously created style sheet for page N-1.
    const pageNum = metadataFields.pageNum;
    if (styleSheet[styleSheetPageNum] !== pageNum) {
        styleSheet[styleSheetPageNum] = pageNum;
        styleSheet[styleSheetId] = shortid();
        // need to pass a create style sheet event (don't add it to any nodes, but do create it)
        trackStyleChange(time(), styleSheet[styleSheetId], StyleSheetOperation.Create);
    }
}

export function checkDocumentStyles(documentNode: Document): void {
    if (!documentNode?.adoptedStyleSheets) {
        // if we don't have adoptedStyledSheets on the Node passed to us, we can short circuit.
        return;
    }   
    let currentStyleSheets: string[] = [];
    for (var styleSheet of documentNode.adoptedStyleSheets) {
        const pageNum = metadataFields.pageNum;
        // if we haven't seen this style sheet, create it and pass a replaceSync with its contents
        if (styleSheet[styleSheetPageNum] !== pageNum) {
            styleSheet[styleSheetPageNum] = pageNum;
            styleSheet[styleSheetId] = shortid();
            trackStyleChange(time(), styleSheet[styleSheetId], StyleSheetOperation.Create);
            trackStyleChange(time(), styleSheet[styleSheetId], StyleSheetOperation.ReplaceSync, getCssRules(styleSheet));
        }
        currentStyleSheets.push(styleSheet[styleSheetId]);
    }

    let documentId = getId(documentNode, true);
    if (!styleSheetMap[documentId]) {
        styleSheetMap[documentId] = [];
    }
    if (!arraysEqual(currentStyleSheets, styleSheetMap[documentId])) {
        // Using -1 to signify the root document node as we don't track that as part of our nodeMap
        trackStyleAdoption(time(), documentNode == document ? -1 : getId(documentNode), StyleSheetOperation.SetAdoptedStyles, currentStyleSheets);
        styleSheetMap[documentId] = currentStyleSheets;
    }
}

export function compute(): void {
    checkDocumentStyles(document);
    Object.keys(styleSheetMap).forEach((x) => checkDocumentStyles(getNode(parseInt(x, 10)) as Document));
}

export function reset(): void {
    state = [];
    
}

export function stop(): void {
    styleSheetMap = {};
    reset();
}

function trackStyleChange(time: number, id: string, operation: StyleSheetOperation, cssRules?: string): void {
    state.push({
        time,
        event: Event.StyleSheetUpdate,
        data: {
            id,
            operation,
            cssRules
        }
    });

    encode(Event.StyleSheetUpdate);
}

function trackStyleAdoption(time: number, id: number, operation: StyleSheetOperation, newIds: string[]): void {
    state.push({
        time,
        event: Event.StyleSheetAdoption,
        data: {
            id,
            operation,
            newIds
        }
    });

    encode(Event.StyleSheetAdoption);
}

function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) {
        return false;
    }

    return a.every((value, index) => value === b[index]);
}
