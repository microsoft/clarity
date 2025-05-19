import { ExtractSource, type Syntax, Type } from "@clarity-types/core";
import { Event, type ExtractData, Setting } from "@clarity-types/data";
import { Code, Constant, Severity } from "@clarity-types/data";
import { hashText } from "@src/clarity";
import hash from "@src/core/hash";
import * as internal from "@src/diagnostic/internal";
import encode from "./encode";

export const data: ExtractData = {};
export const keys: Set<number> = new Set();

const variables: { [key: number]: { [key: number]: Syntax[] } } = {};
const selectors: { [key: number]: { [key: number]: string } } = {};
const hashes: { [key: number]: { [key: number]: string } } = {};
const validation: { [key: number]: string } = {};

export function start(): void {
    reset();
}

// Input string is of the following form:
// EXTRACT 101|element { "1": ".class1", "2": "~window.a.b", "3": "!abc"}
// if element is present on the page it will set up event 101 to grab the contents of the class1 selector into component 1,
// the javascript evaluated contents of window.a.b into component 2,
// and the contents of Clarity's hash abc into component 3
export function trigger(input: string): void {
    try {
        const parts = input && input.length > 0 ? input.split(/ (.*)/) : [Constant.Empty];
        const keyparts = parts[0].split(/\|(.*)/);
        const key = Number.parseInt(keyparts[0]);
        const element = keyparts.length > 1 ? keyparts[1] : Constant.Empty;
        const values = parts.length > 1 ? JSON.parse(parts[1]) : {};
        variables[key] = {};
        selectors[key] = {};
        hashes[key] = {};
        validation[key] = element;
        for (const v in values) {
            // values is a set of strings for proper JSON parsing, but it's more efficient
            // to interact with them as numbers
            const id = Number.parseInt(v);
            const value = values[v] as string;
            let source = ExtractSource.Text;
            if (value.startsWith(Constant.Tilde)) {
                source = ExtractSource.Javascript;
            } else if (value.startsWith(Constant.Bang)) {
                source = ExtractSource.Hash;
            }
            switch (source) {
                case ExtractSource.Javascript: {
                    const variable = value.slice(1);
                    variables[key][id] = parse(variable);
                    break;
                }
                case ExtractSource.Text:
                    selectors[key][id] = value;
                    break;
                case ExtractSource.Hash: {
                    const hash = value.slice(1);
                    hashes[key][id] = hash;
                    break;
                }
            }
        }
    } catch (e) {
        internal.log(Code.Config, Severity.Warning, e ? e.name : null);
    }
}

export function clone(v: Syntax[]): Syntax[] {
    return JSON.parse(JSON.stringify(v));
}

export function compute(): void {
    try {
        for (const v in variables) {
            const key = Number.parseInt(v);
            if (validation[key] === Constant.Empty || document.querySelector(validation[key])) {
                const variableData = variables[key];
                for (const v in variableData) {
                    const variableKey = Number.parseInt(v);
                    const value = str(evaluate(clone(variableData[variableKey])));
                    if (value) {
                        update(key, variableKey, value);
                    }
                }

                const selectorData = selectors[key];
                for (const s in selectorData) {
                    let shouldMask = false;
                    const selectorKey = Number.parseInt(s);
                    let selector = selectorData[selectorKey];
                    if (selector.startsWith(Constant.At)) {
                        shouldMask = true;
                        selector = selector.slice(1);
                    }
                    const nodes = document.querySelectorAll(selector) as NodeListOf<HTMLElement>;
                    if (nodes) {
                        const text = Array.from(nodes)
                            .map((e) => e.textContent)
                            .join(Constant.Seperator);
                        update(key, selectorKey, (shouldMask ? hash(text).trim() : text).slice(0, Setting.ExtractLimit));
                    }
                }

                const hashData = hashes[key];
                for (const h in hashData) {
                    const hashKey = Number.parseInt(h);
                    const content = hashText(hashData[hashKey]).trim().slice(0, Setting.ExtractLimit);
                    update(key, hashKey, content);
                }
            }
        }

        if (keys.size > 0) {
            encode(Event.Extract);
        }
    } catch (e) {
        internal.log(Code.Selector, Severity.Warning, e ? e.name : null);
    }
}

export function reset(): void {
    keys.clear();
}

export function update(key: number, subkey: number, value: string): void {
    let update = false;
    if (!(key in data)) {
        data[key] = {};
        update = true;
    }

    if (!isEmpty(hashes[key]) && (!(subkey in data[key]) || data[key][subkey] !== value)) {
        update = true;
    }

    data[key][subkey] = value;
    if (update) {
        keys.add(key);
    }

    return;
}

export function stop(): void {
    reset();
}

function parse(variable: string): Syntax[] {
    const syntax: Syntax[] = [];
    const parts = variable.split(Constant.Dot);
    while (parts.length > 0) {
        const part = parts.shift();
        const arrayStart = part.indexOf(Constant.ArrayStart);
        const conditionStart = part.indexOf(Constant.ConditionStart);
        const conditionEnd = part.indexOf(Constant.ConditionEnd);
        syntax.push({
            name: arrayStart > 0 ? part.slice(0, arrayStart) : conditionStart > 0 ? part.slice(0, conditionStart) : part,
            type: arrayStart > 0 ? Type.Array : conditionStart > 0 ? Type.Object : Type.Simple,
            condition: conditionStart > 0 ? part.slice(conditionStart + 1, conditionEnd) : null,
        });
    }

    return syntax;
}

// The function below takes in a variable name in following format: "a.b.c" and safely evaluates its value in javascript context
// For instance, for a.b.c, it will first check window["a"]. If it exists, it will recursively look at: window["a"]["b"] and finally,
// return the value for window["a"]["b"]["c"].
// biome-ignore lint/complexity/noBannedTypes: type of base is intentionally generic
// biome-ignore lint/suspicious/noExplicitAny: type of return value isn't known
function evaluate(variable: Syntax[], base: Object = window): any {
    if (variable.length === 0) {
        return base;
    }
    const part = variable.shift();
    // biome-ignore lint/suspicious/noImplicitAnyLet: type of return value isn't known
    let output;
    if (base?.[part.name]) {
        const obj = base[part.name];
        if (part.type !== Type.Array && match(obj, part.condition)) {
            output = evaluate(variable, obj);
        } else if (Array.isArray(obj)) {
            const filtered = [];
            for (const value of obj) {
                if (match(value, part.condition)) {
                    const op = evaluate(variable, value);
                    if (op) {
                        filtered.push(op);
                    }
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
    return input ? JSON.stringify(input).slice(0, Setting.ExtractLimit) : input;
}

// biome-ignore lint/complexity/noBannedTypes: type of base is intentionally generic
function match(base: Object, condition: string): boolean {
    if (condition) {
        const prop = condition.split(":");
        return prop.length > 1 ? base[prop[0]] === prop[1] : base[prop[0]];
    }

    return true;
}

// biome-ignore lint/complexity/noBannedTypes: type of obj is intentionally generic
function isEmpty(obj: Object): boolean {
    return Object.keys(obj).length === 0;
}
