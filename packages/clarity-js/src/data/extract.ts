import { Source } from "@clarity-types/core";
import { Event, Setting } from "@clarity-types/data";
import config from "@src/core/config";
import encode from "./encode";
import * as dom from "@src/layout/dom";
import * as internal from "@src/diagnostic/internal";
import { Code, Constant, Severity } from "@clarity-types/data";

export let data: {[key: number]: string } = {};
export let updateKeys: (number | string)[] = [];

let variables : { [key: number]: string } = {};
let selectors : { [key: number]: string } = {};

export function start(): void {
    let e = config.extract;
    for (let i = 0; i < e.length; i+=3) {
        let source = e[i] as Source;
        let key = e[i+1] as number;
        switch (source) {
            case Source.Javascript: 
                let variable = e[i+2] as string;
                variables[key] = variable;
                break;
            case Source.Cookie: 
                break;
            case Source.Text:
                let match = e[i+2] as string;
                selectors[key] = match;
                break;
            case Source.Fragment:
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
                
        let fragmentIds = dom.getFragments();
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

// The function below takes in a variable name in following format: "a.b.c" and safely evaluates its value in javascript context
// For instance, for a.b.c, it will first check window["a"]. If it exists, it will recursively look at: window["a"]["b"] and finally,
// return the value for window["a"]["b"]["c"].
function evaluate(variable: string, type: string = null, base: Object = window): any {
    let parts = variable.split(Constant.Dot);
    let syntax = parts.shift();
    let [first, array, condition] = parse(syntax);
    let output;
    if (base && base[first]) {
        if (array === -1 && match(base[first], condition)) {
            output = parts.length > 0 ? evaluate(parts.join(Constant.Dot), type, base[first]) : base[first]
        }
        else if (Array.isArray(base[first])) {
            let filtered = [];
            for (var value of base[first]) {
                if (match(value, condition)) {
                    parts.length > 0 ? filtered.push(evaluate(parts.join(Constant.Dot), type, value)) : filtered.push(value);
                }
            }
            output = filtered;
        }
        
        return str(output);
    }

    return null;
}

function parse(variable: string): any {
    let array = variable.indexOf(Constant.ArrayStart);
    let conditionStart = variable.indexOf(Constant.ConditionStart);
    let condition = conditionStart > 0 ? variable.substring(conditionStart + 1, variable.indexOf(Constant.ConditionEnd)) : null;
    let subPart = array > 0 ? variable.substring(0, array) : conditionStart > 0 ? variable.substring(0, conditionStart) : variable;
    return [subPart, array, condition];
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