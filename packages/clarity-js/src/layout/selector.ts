import { Character } from "../../types/data";
import { Constant, Selector, SelectorInput } from "../../types/layout";

const excludeClassNames = Constant.ExcludeClassNames.split(Constant.Comma);
let selectorMap: { [selector: string]: number[] } = {};

export function reset(): void {
    selectorMap = {};
}

export function get(input: SelectorInput, type: Selector): string {
    let a = input.attributes;
    let prefix = input.prefix ? input.prefix[type] : null;
    let suffix = type === Selector.Alpha ? `${Constant.Tilde}${input.position-1}` : `:nth-of-type(${input.position})`;
    switch (input.tag) {
        case "STYLE":
        case "TITLE":
        case "LINK":
        case "META":
        case Constant.TextTag:
        case Constant.DocumentTag:
            return Constant.Empty;
        case "HTML":
            return Constant.HTML;
        default:
            if (prefix === null) { return Constant.Empty; }
            prefix = `${prefix}${Constant.Separator}`;
            input.tag = input.tag.indexOf(Constant.SvgPrefix) === 0 ? input.tag.substr(Constant.SvgPrefix.length) : input.tag;
            let selector = `${prefix}${input.tag}${suffix}`;
            let id = Constant.Id in a && a[Constant.Id].length > 0 ? a[Constant.Id] : null;
            let classes = input.tag !== Constant.BodyTag && Constant.Class in a && a[Constant.Class].length > 0 ? a[Constant.Class].trim().split(/\s+/).filter(c => filter(c)).join(Constant.Period) : null;
            if (classes && classes.length > 0) {
                if (type === Selector.Alpha) {
                    // In Alpha mode, update selector to use class names, with relative positioning within the parent id container.
                    // If the node has valid class name(s) then drop relative positioning within the parent path to keep things simple.
                    let key = `${getDomPath(prefix)}${input.tag}${Constant.Dot}${classes}`;
                    if (!(key in selectorMap)) { selectorMap[key] = []; }
                    if (selectorMap[key].indexOf(input.id) < 0) { selectorMap[key].push(input.id); }
                    selector = `${key}${Constant.Tilde}${selectorMap[key].indexOf(input.id)}`;
                } else {
                    // In Beta mode, we continue to look at query selectors in context of the full page
                    selector = `${prefix}${input.tag}.${classes}${suffix}`
                }
            }
            // Update selector to use "id" field when available. There are two exceptions:
            // (1) if "id" appears to be an auto generated string token, e.g. guid or a random id containing digits
            // (2) if "id" appears inside a shadow DOM, in which case we continue to prefix up to shadow DOM to prevent conflicts
            selector = id && filter(id) ? `${getDomPrefix(prefix)}${Constant.Hash}${id}` : selector;
            return selector;
    }
}

function getDomPrefix(prefix: string): string {
  const shadowDomStart = prefix.lastIndexOf(Constant.ShadowDomTag);
  const iframeDomStart = prefix.lastIndexOf(`${Constant.IFramePrefix}${Constant.HTML}`);
  const domStart = Math.max(shadowDomStart, iframeDomStart);
  
  if (domStart < 0) { return Constant.Empty; }

  return prefix.substring(0, prefix.indexOf(Constant.Separator, domStart) + 1);
}

function getDomPath(input: string): string {
    let parts = input.split(Constant.Separator);
    for (let i = 0; i < parts.length; i++) {
        let tIndex = parts[i].indexOf(Constant.Tilde);
        let dIndex = parts[i].indexOf(Constant.Dot);
        parts[i] = parts[i].substring(0, dIndex > 0 ? dIndex : (tIndex > 0 ? tIndex : parts[i].length));
    }
    return parts.join(Constant.Separator);
}

// Check if the given input string has digits or excluded class names
function filter(value: string): boolean {
    if (!value) { return false; } // Do not process empty strings
    if (excludeClassNames.some(x => value.toLowerCase().indexOf(x) >= 0)) { return false; }
    for (let i = 0; i < value.length; i++) {
        let c = value.charCodeAt(i);
        if (c >= Character.Zero && c <= Character.Nine) { return false };
    }
    return true;
}
