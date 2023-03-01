import { ExtractSource, Syntax, Type } from "@clarity-types/core";
import { Event, Setting, ExtractData } from "@clarity-types/data";
import encode from "./encode";
import * as internal from "@src/diagnostic/internal";
import { Code, Constant, Severity } from "@clarity-types/data";

export let data: ExtractData = {};
export let keys: number[] = [];

let variables : { [key: number]: { [key: string]: Syntax[] }} = {};
let selectors : { [key: number]: { [key: string]: string }} = {};
export function start(): void {
    reset();
}

export function trigger(input: string): void { 
    try {
        var parts = input && input.length > 0 ? input.split(/ (.*)/) : [Constant.Empty];
        var key = parseInt(parts[0]);
        var values = parts.length > 1 ? JSON.parse(parts[1]) : {};
        variables[key] = {};
        selectors[key] = {};
        for (var v in values) {
            let value = values[v] as string;
            let source = value.startsWith(Constant.Tilde) ? ExtractSource.Javascript : ExtractSource.Text;
            switch (source) {
                case ExtractSource.Javascript:
                    let variable = value.substring(1, value.length);
                    variables[key][v] = parse(variable);
                    break;
                case ExtractSource.Text:
                    selectors[key][v] = value;
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
        for (let v in variables) {
            let key = parseInt(v);
            if (!(key in keys)) {
                let variableData = variables[key];
                for (let variableKey in variableData) {
                    let value = str(evaluate(clone(variableData[variableKey])));
                    if (value) { update(key, variableKey, value); }
                }

                let selectorData = selectors[key];
                for (let selectorKey in selectorData) {
                    let nodes = document.querySelectorAll(selectorData[selectorKey]) as NodeListOf<HTMLElement>;
                    let text = [];
                    if (nodes) {
                        nodes.forEach((element) => {
                            text.push(element.innerText);
                        })
                        update(key, selectorKey, text.join(Constant.Seperator));
                    }
                }
            }
        }
    }
    catch (e) { internal.log(Code.Selector, Severity.Warning, e ? e.name : null); }

    encode(Event.Extract);
}

export function reset(): void {
    data = {};
    keys = [];
    variables = {};
    selectors = {};
}

export function update(key: number, subkey: string,  value: string): void {
    if (!(key in data)) {
        data[key] = []
        keys.push(key);
    }
    data[key].push([subkey, value]);
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