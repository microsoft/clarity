import { ExtractSource, Syntax, Type } from "@clarity-types/core";
import { Event, Setting, ExtractData } from "@clarity-types/data";
import encode from "./encode";
import * as internal from "@src/diagnostic/internal";
import { Code, Constant, Severity } from "@clarity-types/data";
import { hashText } from "@src/clarity";

export let data: ExtractData = {};
export let keys: number[] = [];

let variables : { [key: number]: { [key: number]: Syntax[] }} = {};
let selectors : { [key: number]: { [key: number]: string }} = {};
let hashes : { [key: number]: { [key: number]: string }} = {};
export function start(): void {
    reset();
}

// Input string is of the following form:
// EXTRACT 101 { "1": ".class1", "2": "~window.a.b", "3": "!abc"}
// Which will set up event 101 to grab the contents of the class1 selector into component 1,
// the javascript evaluated contents of window.a.b into component 2,
// and the contents of Clarity's hash abc into component 3
export function trigger(input: string): void { 
    try {
        var parts = input && input.length > 0 ? input.split(/ (.*)/) : [Constant.Empty];
        var key = parseInt(parts[0]);
        var values = parts.length > 1 ? JSON.parse(parts[1]) : {};
        variables[key] = {};
        selectors[key] = {};
        hashes[key] = {};
        for (var v in values) {
            // values is a set of strings for proper JSON parsing, but it's more efficient 
            // to interact with them as numbers
            let id = parseInt(v);
            let value = values[v] as string;
            let source = ExtractSource.Text;
            if (value.startsWith(Constant.Tilde)) {
                source = ExtractSource.Javascript
            } else if (value.startsWith(Constant.Bang)) {
                source = ExtractSource.Hash
            }
            switch (source) {
                case ExtractSource.Javascript:
                    let variable = value.substring(1, value.length);
                    variables[key][id] = parse(variable);
                    break;
                case ExtractSource.Text:
                    selectors[key][id] = value;
                    break;
                case ExtractSource.Hash:
                    let hash = value.substring(1, value.length);
                    hashes[key][id] = hash;
                    break;
            }
        }
    }
    catch(e) {
        internal.log(Code.Config, Severity.Warning, e ? e.name : null);
    }
}

export function clone(v: Syntax[]): Syntax[] {
    return JSON.parse(JSON.stringify(v));
}

export function compute(): void {
    try {
        for (let h in hashes) {
            let key = parseInt(h);
            if (!(key in keys)) {
                let variableData = variables[key];
                for (let v in variableData) {
                    let variableKey = parseInt(v);
                    let value = str(evaluate(clone(variableData[variableKey])));
                    if (value) { update(key, variableKey, value); }
                }

                let selectorData = selectors[key];
                for (let s in selectorData) {
                    let selectorKey = parseInt(s);
                    let nodes = document.querySelectorAll(selectorData[selectorKey]) as NodeListOf<HTMLElement>;
                    if (nodes) {
                        let text = Array.from(nodes).map(e => e.innerText)
                        update(key, selectorKey, text.join(Constant.Seperator).substring(0, Setting.ExtractLimit));
                    }
                }

                let hashData = hashes[key];
                for (let h in hashData) {
                    let hashKey = parseInt(h);
                    let content = hashText(hashData[hashKey]).trim().substring(0, Setting.ExtractLimit);
                    // update only if we haven't grabbed this before or if it has changed
                    let shouldUpdate = true;
                    if (key in data) {
                        for (let extractData of data[key]) {
                            if (extractData[0] === hashKey) {
                                // extractData[1] is the value we uploaded last, check if it has changed
                                if (extractData[1] === content) {
                                    shouldUpdate = false;
                                }
                            }
                        }
                    }

                    if (shouldUpdate) {
                        update(key, hashKey, content, true);
                    }
                }
            }
        }
    }
    catch (e) { internal.log(Code.Selector, Severity.Warning, e ? e.name : null); }

    encode(Event.Extract);
}

export function reset(): void {
    // only clear out the parts of data which weren't marked as updateOnChange
    let dynamicData = {};
    for (let d in data) {
        let key = parseInt(d);
        for (let row of data[key]) {
            if (row[2]) {
                if (!(key in dynamicData)) {
                    dynamicData[key] = [];
                }
                dynamicData[key].push(row);
            }
        }
    }
    data = dynamicData;
    keys = [];
    variables = {};
    selectors = {};
}

export function update(key: number, subkey: number, value: string, updateOnChange: boolean = false): void {
    if (!(key in data)) {
        data[key] = []
        keys.push(key);
    }
    data[key].push([subkey, value, updateOnChange]);
}

export function stop(): void {
   reset();
}

function parse(variable: string): Syntax[] {
    let syntax: Syntax[] = [];
    let parts = variable.split(Constant.Dot);
    while (parts.length > 0) {
        let part = parts.shift();
        let arrayStart = part.indexOf(Constant.ArrayStart);
        let conditionStart = part.indexOf(Constant.ConditionStart);
        let conditionEnd = part.indexOf(Constant.ConditionEnd);
        syntax.push({
            name : arrayStart > 0 ? part.substring(0, arrayStart) : (conditionStart > 0 ? part.substring(0, conditionStart) : part),
            type : arrayStart > 0 ? Type.Array : (conditionStart > 0 ? Type.Object : Type.Simple),
            condition : conditionStart > 0 ? part.substring(conditionStart + 1, conditionEnd) : null
        });
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
        
        return output;
    }

    return null;
}

function str(input: string): string {
    // Automatically trim string to max of Setting.ExtractLimit to avoid fetching long strings
    return input ? JSON.stringify(input).substring(0, Setting.ExtractLimit) : input;
}

function match(base: Object, condition: string): boolean {
    if (condition) {
        let prop = condition.split(":");
        return prop.length > 1 ? base[prop[0]] == prop[1] : base[prop[0]]
    }

    return true;
}