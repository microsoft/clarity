import { Dimension, Extract, Metric, Region, RegionFilter } from "@clarity-types/core";
import { Constant, Setting } from "@clarity-types/data";
import * as dimension from "@src/data/dimension";
import * as metric from "@src/data/metric";
import * as region from "@src/layout/region";

const formatRegex = /1/g;
const digitsRegex = /[^0-9\.]/g;
const digitsWithCommaRegex = /[^0-9\.,]/g;
const regexCache: {[key: string]: RegExp} = {};

export function regions(root: ParentNode, value: Region[]): void {
    for (let v of value) {
        const [regionId, selector, filter, match] = v;
        let valid = true;
        switch (filter) {
            case RegionFilter.Url: valid = match && !!top.location.href.match(regex(match)); break;
            case RegionFilter.Javascript: valid = match && !!evaluate(match); break;
        }
        if (valid) { root.querySelectorAll(selector).forEach(e => region.observe(e, regionId.toString())); }
    }
}

export function metrics(root: ParentNode, value: Metric[]): void {
    for (let v of value) {
        const [metricId, source, match, scale] = v;
        if (match) {
            switch (source) {
                case Extract.Text:  root.querySelectorAll(match).forEach(e => { metric.max(metricId, num((e as HTMLElement).innerText, scale)); }); break;
                case Extract.Attribute: root.querySelectorAll(`[${match}]`).forEach(e => { metric.max(metricId, num(e.getAttribute(match), scale, false)); }); break;
                case Extract.Javascript: metric.max(metricId, evaluate(match, Constant.Number) as number); break;
            }
        }
    }
}

export function dimensions(root: ParentNode, value: Dimension[]): void {
    for (let v of value) {
        const [dimensionId, source, match] = v;
        if (match) {
            switch (source) {
                case Extract.Text:  root.querySelectorAll(match).forEach(e => { dimension.log(dimensionId, str((e as HTMLElement).innerText)); }); break;
                case Extract.Attribute: root.querySelectorAll(`[${match}]`).forEach(e => { dimension.log(dimensionId, str(e.getAttribute(match))); }); break;
                case Extract.Javascript: dimension.log(dimensionId, str(evaluate(match, Constant.String))); break;
            }
        }
    }
}

function regex(match: string): RegExp {
    regexCache[match] = match in regexCache ? regexCache[match] : new RegExp(match);
    return regexCache[match];
}

// The function below takes in a variable name in following format: "a.b.c" and safely evaluates its value in javascript context
// For instance, for a.b.c, it will first check window["a"]. If it exists, it will recursively look at: window["a"]["b"] and finally,
// return the value for window["a"]["b"]["c"].
function evaluate(variable: string, type: string = null, base: Object = window): any {
    let parts = variable.split(Constant.Dot);
    let first = parts.shift();
    if (base && base[first]) {
        if (parts.length > 0) { return evaluate(parts.join(Constant.Dot), type, base[first]); } 
        let output = type === null || type === typeof base[first] ? base[first] : null;
        return output;
    }
    return null;
}

function str(input: string): string {
    // Automatically trim string to max of Setting.DimensionLimit to avoid fetching long strings
    return input ? input.substr(0, Setting.DimensionLimit) : input;
}

function num(text: string, scale: number, localize: boolean = true): number {
    try {
        scale = scale || 1; 
        // Reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
        let lang = document.documentElement.lang;
        if (Intl && Intl.NumberFormat && lang && localize) {
            text = text.replace(digitsWithCommaRegex, Constant.Empty);
            // Infer current group and decimal separator from current locale
            let group = Intl.NumberFormat(lang).format(11111).replace(formatRegex, Constant.Empty);
            let decimal = Intl.NumberFormat(lang).format(1.1).replace(formatRegex, Constant.Empty);
            
            // Parse number using inferred group and decimal separators
            return Math.round(parseFloat(text
                .replace(new RegExp('\\' + group, 'g'), Constant.Empty)
                .replace(new RegExp('\\' + decimal), Constant.Dot)
            ) * scale);
        }
        // Fallback to en locale
        return Math.round(parseFloat(text.replace(digitsRegex, Constant.Empty)) * scale);
    } catch { return null; }
}
