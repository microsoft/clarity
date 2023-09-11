import { Event } from "@clarity-types/data";
import { StyleSheetOperation, StyleSheetState } from "@clarity-types/layout";
import { time } from "@src/core/time";
import { shortid } from "@src/data/metadata";
import encode from "@src/layout/encode";
import { getId } from "@src/layout/dom";
import * as core from "@src/core";
import { getCssRules } from "./node";

export let state: StyleSheetState[] = [];
let replace: (text?: string) => Promise<CSSStyleSheet> = null;
let replaceSync: (text?: string) => void = null;
const styleSheetId = 'claritySheetId';
let styleSheetMap = {};

export function start(): void {
    reset();

    if (replace === null) { 
        replace = CSSStyleSheet.prototype.replace; 
        CSSStyleSheet.prototype.replace = function(): Promise<CSSStyleSheet> {
            if (core.active()) {
                if (!this[styleSheetId]) {
                    this[styleSheetId] = shortid();
                    // need to pass a create style sheet event (don't add it to any nodes, but do create it)
                    trackStyleChange(time(), this[styleSheetId], StyleSheetOperation.Create);
                }

                trackStyleChange(time(), this[styleSheetId], StyleSheetOperation.Replace, arguments[0]);
            }
            return replace.apply(this, arguments);
        };
    }

    if (replaceSync === null) { 
        replaceSync = CSSStyleSheet.prototype.replaceSync; 
        CSSStyleSheet.prototype.replaceSync = function(): void {
            if (core.active()) {
                if (!this[styleSheetId]) {
                    this[styleSheetId] = shortid();
                    // need to pass a create style sheet event (don't add it to any nodes, but do create it)
                    trackStyleChange(time(), this[styleSheetId], StyleSheetOperation.Create);
                }
                trackStyleChange(time(), this[styleSheetId], StyleSheetOperation.ReplaceSync, arguments[0]);
            }
            console.log('replaceSync:');
            console.log(this);
            console.log(arguments);
            return replaceSync.apply(this, arguments);
        };
    }
}

export function watchDocument(documentNode: Document): void {
    if (!documentNode[styleSheetId]) {
        documentNode[styleSheetId] = shortid();
        styleSheetMap[documentNode[styleSheetId]] = documentNode.adoptedStyleSheets;
        Object.defineProperty(documentNode, "adoptedStyleSheets", {
            set(newStyleSheets: CSSStyleSheet[]) {
                for (var styleSheet of newStyleSheets) {
                    // if we haven't seen this style sheet, create it and pass a replaceSync with its contents
                    styleSheet[styleSheetId] = shortid();
                    trackStyleChange(time(), styleSheet[styleSheetId], StyleSheetOperation.Create);
                    trackStyleChange(time(), styleSheet[styleSheetId], StyleSheetOperation.ReplaceSync, getCssRules(styleSheet));
                }
                var newIds = <string[]>newStyleSheets.map(x => x[styleSheetId]);
                trackStyleAdoption(time(), getId(documentNode), StyleSheetOperation.SetAdoptedStyles, newIds);
                console.log('watchDocument:');
                console.log(documentNode);
                console.log(newStyleSheets);
                styleSheetMap[documentNode[styleSheetId]] = newStyleSheets;
            },
            get() {
                return styleSheetMap[documentNode[styleSheetId]];
            },
        });
    }    
}

export function reset(): void {
    state = [];
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

function trackStyleAdoption(time: number, id: number, operation: StyleSheetOperation, newIds?: string[]): void {
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

export function stop(): void {
    state = [];
    reset();
}
