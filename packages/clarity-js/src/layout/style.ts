import { Event, Metric } from "@clarity-types/data";
import { StyleSheetOperation, type StyleSheetState } from "@clarity-types/layout";
import * as core from "@src/core";
import config from "@src/core/config";
import { time } from "@src/core/time";
import { shortid } from "@src/data/metadata";
import { getId } from "@src/layout/dom";
import encode from "@src/layout/encode";
import { getCssRules } from "./node";

export let sheetUpdateState: StyleSheetState[] = [];
export let sheetAdoptionState: StyleSheetState[] = [];
const styleSheetId = "claritySheetId";
let styleSheetMap = {};
let styleTimeMap: { [key: string]: number } = {};
let documentNodes = [];
let createdSheetIds = [];

function proxyStyleRules(win: any) {
    if ((config.lean && config.lite) || win === null || win === undefined) {
        return;
    }

    win.clarityOverrides = win.clarityOverrides || {};

    if (win["CSSStyleSheet"] && win.CSSStyleSheet.prototype) {
        if (win.clarityOverrides.replace === undefined) {
            win.clarityOverrides.replace = win.CSSStyleSheet.prototype.replace;
            win.CSSStyleSheet.prototype.replace = function (): Promise<CSSStyleSheet> {
                if (core.active()) {
                    // if we haven't seen this stylesheet on this page yet, wait until the checkDocumentStyles has found it
                    // and attached the sheet to a document. This way the timestamp of the style sheet creation will align
                    // to when it is used in the document rather than potentially being misaligned during the traverse process.
                    if (createdSheetIds.indexOf(this[styleSheetId]) > -1) {
                        trackStyleChange(time(), this[styleSheetId], StyleSheetOperation.Replace, arguments[0]);
                    }
                }
                return win.clarityOverrides.replace.apply(this, arguments);
            };
        }

        if (win.clarityOverrides.replaceSync === undefined) {
            win.clarityOverrides.replaceSync = win.CSSStyleSheet.prototype.replaceSync;
            win.CSSStyleSheet.prototype.replaceSync = function (): void {
                if (core.active()) {
                    // if we haven't seen this stylesheet on this page yet, wait until the checkDocumentStyles has found it
                    // and attached the sheet to a document. This way the timestamp of the style sheet creation will align
                    // to when it is used in the document rather than potentially being misaligned during the traverse process.
                    if (createdSheetIds.indexOf(this[styleSheetId]) > -1) {
                        trackStyleChange(time(), this[styleSheetId], StyleSheetOperation.ReplaceSync, arguments[0]);
                    }
                }
                return win.clarityOverrides.replaceSync.apply(this, arguments);
            };
        }
    }
}

export function start(): void {
    proxyStyleRules(window);
}

export function checkDocumentStyles(documentNode: Document, timestamp: number): void {
    if (config.lean && config.lite) {
        return;
    }

    if (documentNodes.indexOf(documentNode) === -1) {
        documentNodes.push(documentNode);
        if (documentNode.defaultView) {
            proxyStyleRules(documentNode.defaultView);
        }
    }
    timestamp = timestamp || time();
    if (!documentNode?.adoptedStyleSheets) {
        // if we don't have adoptedStyledSheets on the Node passed to us, we can short circuit.
        return;
    }
    const currentStyleSheets: string[] = [];
    for (var styleSheet of documentNode.adoptedStyleSheets) {
        // If we haven't seen this style sheet on this page yet, we create a reference to it for the visualizer.
        // For SPA or times in which Clarity restarts on a given page, our visualizer would lose context
        // on the previously created style sheet for page N-1.
        // Then we synthetically call replaceSync with its contents to bootstrap it
        if (!styleSheet[styleSheetId] || createdSheetIds.indexOf(styleSheet[styleSheetId]) === -1) {
            styleSheet[styleSheetId] = shortid();
            createdSheetIds.push(styleSheet[styleSheetId]);
            trackStyleChange(timestamp, styleSheet[styleSheetId], StyleSheetOperation.Create);
            trackStyleChange(timestamp, styleSheet[styleSheetId], StyleSheetOperation.ReplaceSync, getCssRules(styleSheet));
        }

        currentStyleSheets.push(styleSheet[styleSheetId]);
    }

    const documentId = getId(documentNode, true);
    if (!styleSheetMap[documentId]) {
        styleSheetMap[documentId] = [];
    }
    if (!arraysEqual(currentStyleSheets, styleSheetMap[documentId])) {
        // Using -1 to signify the root document node as we don't track that as part of our nodeMap
        trackStyleAdoption(
            timestamp,
            documentNode == document ? -1 : getId(documentNode),
            StyleSheetOperation.SetAdoptedStyles,
            currentStyleSheets,
        );
        styleSheetMap[documentId] = currentStyleSheets;
        styleTimeMap[documentId] = timestamp;
    }
}

export function compute(): void {
    for (var documentNode of documentNodes) {
        var docId = documentNode == document ? -1 : getId(documentNode);
        const ts = docId in styleTimeMap ? styleTimeMap[docId] : null;
        checkDocumentStyles(documentNode, ts);
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
    createdSheetIds = [];
    reset();
}

function trackStyleChange(time: number, id: string, operation: StyleSheetOperation, cssRules?: string): void {
    sheetUpdateState.push({
        time,
        event: Event.StyleSheetUpdate,
        data: {
            id,
            operation,
            cssRules,
        },
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
            newIds,
        },
    });

    encode(Event.StyleSheetAdoption);
}

function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) {
        return false;
    }

    return a.every((value, index) => value === b[index]);
}
