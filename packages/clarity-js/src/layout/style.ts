import { Event, Metric } from "@clarity-types/data";
import { StyleSheetOperation, StyleSheetState } from "@clarity-types/layout";
import { time } from "@src/core/time";
import { shortid, data as metadataFields } from "@src/data/metadata";
import encode from "@src/layout/encode";
import { getId, getNode } from "@src/layout/dom";
import * as core from "@src/core";
import { getCssRules } from "./node";
import * as metric from "@src/data/metric";
import { schedule } from "@src/core/task";

export let adoptionState: StyleSheetState[] = [];
export let styleRuleState: StyleSheetState[] = [];
export let updateState: StyleSheetState[] = [];
let replace: (text?: string) => Promise<CSSStyleSheet> = null;
let replaceSync: (text?: string) => void = null;
let declarationSetProperty: (property: string, value: string, priority?: string) => void = null;
const styleSheetId = 'claritySheetId';
const styleSheetPageNum = 'claritySheetNum';
let styleSheetMap = {};
let styleTimeMap: {[key: string]: number} = {};
let documentCache: Document[] = [];
let styleEventsSoFar = 0;

export function start(): void {
    if (replace === null) { 
        replace = CSSStyleSheet.prototype.replace; 
        CSSStyleSheet.prototype.replace = function(): Promise<CSSStyleSheet> {
            if (core.active()) {
                metric.max(Metric.ConstructedStyles, 1);
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
                metric.max(Metric.ConstructedStyles, 1);
                bootStrapStyleSheet(this);
                trackStyleChange(time(), this[styleSheetId], StyleSheetOperation.ReplaceSync, arguments[0]);
            }
            return replaceSync.apply(this, arguments);
        };
    }

    if (declarationSetProperty === null) {
        declarationSetProperty = CSSStyleDeclaration.prototype.setProperty;
        CSSStyleDeclaration.prototype.setProperty = function () {
            if (core.active() && styleEventsSoFar++ < 1000) {
                let timeOfCall = time();
                if (this?.parentRule?.parentStyleSheet?.[styleSheetId]) {
                    const owningStyleSheet: CSSStyleSheet = this.parentRule.parentStyleSheet;
                    var indexOfRule = -1;
                    for (var i = 0; i < owningStyleSheet.cssRules.length; i++) {
                        if (owningStyleSheet.cssRules.item(i) === this.parentRule) {
                            indexOfRule = i;
                            break;
                        }
                    }
                    // console.log(`sam you found the styleSheetId for this update: ${owningStyleSheet[styleSheetId]} at index ${indexOfRule}`);
                    trackRuleChange(timeOfCall, owningStyleSheet[styleSheetId], indexOfRule, arguments[0], arguments[1], arguments[2]);
                } else {
                    console.log('sorry no stylesheet to update');
                }
            }
            return declarationSetProperty.apply(this, arguments);
        }
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

export function checkDocumentStyles(documentNode: Document, timestamp: number): void {
    if (documentCache.indexOf(documentNode) == -1) {
        documentCache.push(documentNode);
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
        // if we haven't seen this style sheet, create it and call replaceSync with its contents to bootstrap it
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
    let ts = -1 in styleTimeMap ? styleTimeMap[-1] : null;
    checkDocumentStyles(document, ts);
    // documentCache.forEach((x) => checkDocumentStyles(x, styleTimeMap[getId(x)]));
    Object.keys(styleSheetMap).forEach((x) => checkDocumentStyles(getNode(parseInt(x, 10)) as Document, styleTimeMap[x]));
}

export function reset(): void {
    adoptionState = [];
    updateState = [];
    styleRuleState = [];
    styleEventsSoFar = 0;
}

export function stop(): void {
    styleSheetMap = {};
    styleTimeMap = {};
    documentCache = [];
    reset();
}

function trackRuleChange(time: number, styleSheetId: string, indexOfRule: number, propertyName: string, value: string, priority?: string): void {
    // TODO (samart): If I comment this push out then the responsiveness is fine, so the problem isn't with the parsing of the sheet ids or anything
    // if I change it to a console.log everything also seems fine - so I'm very confident that capturing the data + writing it somewhere is not a problem
    styleRuleState.push({
        time,
        event: Event.StyleSheetRuleChange,
        data: {
            id: styleSheetId,
            operation: StyleSheetOperation.SetProperty,
            indexOfRule,
            propertyName,
            value,
            priority
        }
    });

    // console.log(styleSheetId);

    // console.log(`adding a new rule: ${styleRuleState.length}`);
    // console.log(styleRuleState);

    // console.log(`would have done a style rule push at ${time}`);
    schedule(encode.bind(this, Event.StyleSheetRuleChange));
    // TODO (samart: trying to not schedule these and instead run them right away to see what changes
    // doesnt make a difference
    // encode(Event.StyleSheetRuleChange);
}

function trackStyleChange(time: number, id: string, operation: StyleSheetOperation, cssRules?: string): void {
    updateState.push({
        time,
        event: Event.StyleSheetUpdate,
        data: {
            id,
            operation,
            cssRules
        }
    });

    // console.log(`style change: id: ${id} operation: ${operation} on page: ${metadataFields.pageNum} and length: ${updateState.length} `);
    // console.log(updateState);

    schedule(encode.bind(this, Event.StyleSheetUpdate));
}

function trackStyleAdoption(time: number, id: number, operation: StyleSheetOperation, newIds: string[]): void {
    adoptionState.push({
        time,
        event: Event.StyleSheetAdoption,
        data: {
            id,
            operation,
            newIds
        }
    });

    //console.log(`adoption change: id: ${id} operation: ${operation} on page: ${metadataFields.pageNum} and length: ${adoptionState.length} `);
    //console.log(adoptionState);

    schedule(encode.bind(this, Event.StyleSheetAdoption));
}

function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) {
        return false;
    }

    return a.every((value, index) => value === b[index]);
}
