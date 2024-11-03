import { Event, Metric } from "@clarity-types/data";
import { StyleSheetOperation, StyleSheetState } from "@clarity-types/layout";
import { time } from "@src/core/time";
import { shortid, data as metadataFields } from "@src/data/metadata";
import encode from "@src/layout/encode";
import { getId } from "@src/layout/dom";
import * as core from "@src/core";
import { getCssRules } from "./node";
import * as metric from "@src/data/metric";

export let sheetUpdateState: StyleSheetState[] = [];
export let sheetAdoptionState: StyleSheetState[] = [];
let replace: (text?: string) => Promise<CSSStyleSheet> = null;
let replaceSync: (text?: string) => void = null;
const styleSheetId = 'claritySheetId';
const styleSheetPageNum = 'claritySheetNum';
let styleSheetMap = {};
let styleTimeMap: {[key: string]: number} = {};
let documentNodes = [];

export function start(): void {
    if (replace === null) { 
        replace = CSSStyleSheet.prototype.replace; 
        CSSStyleSheet.prototype.replace = function(): Promise<CSSStyleSheet> {
            if (core.active()) {
                metric.max(Metric.ConstructedStyles, 1);
                // if we haven't seen this stylesheet on this page yet, wait until the checkDocumentStyles has found it
                // and attached the sheet to a document. This way the timestamp of the style sheet creation will align
                // to when it is used in the document rather than potentially being misaligned during the traverse process.
                if (this[styleSheetPageNum] === metadataFields.pageNum) {
                    trackStyleChange(time(), this[styleSheetId], StyleSheetOperation.Replace, arguments[0]);
                }
            }
            return replace.apply(this, arguments);
        };
    }

    if (replaceSync === null) { 
        replaceSync = CSSStyleSheet.prototype.replaceSync; 
        CSSStyleSheet.prototype.replaceSync = function(): void {
            if (core.active()) {
                metric.max(Metric.ConstructedStyles, 1);
                // if we haven't seen this stylesheet on this page yet, wait until the checkDocumentStyles has found it
                // and attached the sheet to a document. This way the timestamp of the style sheet creation will align
                // to when it is used in the document rather than potentially being misaligned during the traverse process.
                if (this[styleSheetPageNum] === metadataFields.pageNum) {
                    trackStyleChange(time(), this[styleSheetId], StyleSheetOperation.ReplaceSync, arguments[0]);
                }                
            }
            return replaceSync.apply(this, arguments);
        };
    }
}

export function checkDocumentStyles(documentNode: Document, timestamp: number): void {
    if (documentNodes.indexOf(documentNode) === -1) {
        documentNodes.push(documentNode);
    }
    timestamp = timestamp || time();
    if (!documentNode?.adoptedStyleSheets) {
        // if we don't have adoptedStyledSheets on the Node passed to us, we can short circuit.
        return;
    }
    metric.max(Metric.ConstructedStyles, 1);
    let currentStyleSheets: string[] = [];
    for (var styleSheet of documentNode.adoptedStyleSheets) {
        const pageNum = metadataFields.pageNum;
        // If we haven't seen this style sheet on this page yet, we create a reference to it for the visualizer.
        // For SPA or times in which Clarity restarts on a given page, our visualizer would lose context
        // on the previously created style sheet for page N-1.
        // Then we synthetically call replaceSync with its contents to bootstrap it
        if (styleSheet[styleSheetPageNum] !== pageNum) {
            styleSheet[styleSheetPageNum] = pageNum;
            styleSheet[styleSheetId] = shortid();
            trackStyleChange(timestamp, styleSheet[styleSheetId], StyleSheetOperation.Create);
            trackStyleChange(timestamp, styleSheet[styleSheetId], StyleSheetOperation.ReplaceSync, getCssRules(styleSheet));
        }
        currentStyleSheets.push(styleSheet[styleSheetId]);
    }

    let documentId = getId(documentNode, true);
    if (!styleSheetMap[documentId]) {
        styleSheetMap[documentId] = [];
    }
    if (!arraysEqual(currentStyleSheets, styleSheetMap[documentId])) {
        // Using -1 to signify the root document node as we don't track that as part of our nodeMap
        trackStyleAdoption(timestamp, documentNode == document ? -1 : getId(documentNode), StyleSheetOperation.SetAdoptedStyles, currentStyleSheets);
        styleSheetMap[documentId] = currentStyleSheets;
        styleTimeMap[documentId] = timestamp;
    }
}

export function compute(): void {
    for (var documentNode of documentNodes) {
        var docId = documentNode == document ? -1 : getId(documentNode);
        let ts = docId in styleTimeMap ? styleTimeMap[docId] : null;
        checkDocumentStyles(document, ts);
    }
}

export function reset(): void {
    sheetAdoptionState = [];
    sheetUpdateState = [];
}

export function stop(): void {
    styleSheetMap = {};
    styleTimeMap = {};
    documentNodes = [];
    reset();
}

function trackStyleChange(time: number, id: string, operation: StyleSheetOperation, cssRules?: string): void {
    sheetUpdateState.push({
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
    sheetAdoptionState.push({
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
