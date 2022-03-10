import { ExtractSource, Syntax, Type } from "@clarity-types/core";
import { Event, Setting } from "@clarity-types/data";
import config from "@src/core/config";
import encode from "./encode";
import * as dom from "@src/layout/dom";
import * as internal from "@src/diagnostic/internal";
import { Code, Constant, Severity } from "@clarity-types/data";

export let data: {[key: number]: string } = {};
export let updateKeys: (number | string)[] = [];

let variables : { [key: number]: Syntax[] } = {};
let selectors : { [key: number]: string } = {};

export function start(): void {
    let e = config.extract;
    if (!e) { return; }
    for (let i = 0; i < e.length; i+=3) {
        let source = e[i] as ExtractSource;
        let key = e[i+1] as number;
        switch (source) {
            case ExtractSource.Javascript: 
                let variable = e[i+2] as string;
                variables[key] = parse(variable);
                break;
            case ExtractSource.Cookie: 
                /*Todo: Add cookie extract logic*/
                break;
            case ExtractSource.Text:
                let match = e[i+2] as string;
                selectors[key] = match;
                break;
            case ExtractSource.Fragment:
                let fragments =  e[i+2] as string[];
                dom.setFragments(fragments);
                break;
        }
    }
}

export function compute(): void {
    try {
        for (let v in variables) {
            let value = evaluate(variables[v]);
            if (value) { update(v, value); }
        }

        for (let s in selectors) {
            let node = document.querySelector(selectors[s] as string) as HTMLElement;
            if (node) { update(s, node.innerText); }
        }
                
        let fragmentIds = dom.matchFragments();
        for (let hash in fragmentIds) {
            update(hash, fragmentIds[hash], true);
        }
    }
    catch (e) { internal.log(Code.Selector, Severity.Warning, e ? e.name : null); }

    encode(Event.Extract);
}

export function reset(): void {
    updateKeys = [];
}

function update(key: number | string, value: string | number, force: boolean = false): void {
    if (!(key in data) || (key in data && data[key] !== value) || force ) {
        data[key] = value;
        updateKeys.push(key);
    }
}

export function stop(): void {
    data = {};
    updateKeys = [];
    variables = {};
    selectors = {};
}

function parse(variable: string): Syntax[] {
    let syntax: Syntax[] = [];
    let parts = variable.split(Constant.Dot);
    while (parts.length > 0) {
        let s: Syntax;
        let part = parts.shift();
        let arrayStart = part.indexOf(Constant.ArrayStart);
        let conditionStart = part.indexOf(Constant.ConditionStart);
        let conditionEnd = part.indexOf(Constant.ConditionEnd);
        s.name = arrayStart > 0 ? part.substring(0, arrayStart) : (conditionStart > 0 ? part.substring(0, conditionStart) : part);
        s.type = arrayStart > 0 ? Type.Array : (conditionStart > 0 ? Type.Object : Type.Simple);
        s.condition = conditionStart > 0 ? part.substring(conditionStart + 1, conditionEnd) : null;
        syntax.push(s);
    }

    return syntax;
}

// The function below takes in a variable name in following format: "a.b.c" and safely evaluates its value in javascript context
// For instance, for a.b.c, it will first check window["a"]. If it exists, it will recursively look at: window["a"]["b"] and finally,
// return the value for window["a"]["b"]["c"].
function evaluate(variable: Syntax[], base: Object = window): any {
    if (variable.length == 0) { return base; }
    let part = variable.shift();
    let output;
    if (base && base[part.name]) {
        let obj = base[part.name];
        if (part.type !== Type.Array && match(obj, part.condition)) {
            output = evaluate(variable, obj);
        }
        else if (Array.isArray(obj)) {
            let filtered = [];
            for (var value of obj) {
                if (match(value, part.condition)) {
                    let op = evaluate(variable, value)
                    if (op) { filtered.push(op); }
                }
            }
            output = filtered;
        }
        
        return str(output);
    }

    return null;
}
function str(input: string): string {
    // Automatically trim string to max of Setting.DimensionLimit to avoid fetching long strings
    return input ? JSON.stringify(input).substring(0, Setting.ExtractLimit) : input;
}

function match(base: Object, condition: string): boolean {
    if (condition) {
        let prop = condition.split(":");
        return prop.length > 1 ? base[prop[0]] == prop[1] : base[prop[0]]
    }

    return true;
}