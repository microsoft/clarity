import { Character } from "../../types/data";
import { Constant, Selector, SelectorInput } from "../../types/layout";
import { ExcludeClassNamesList } from "./constants";

const excludeClassNames = ExcludeClassNamesList;

export function get(input: SelectorInput): string {
    let a = input.attributes;
    let prefix = input.prefix ? input.prefix[Selector.Beta] : null;
    let suffix = ":nth-of-type(" + input.position + ")";
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
            prefix = prefix + Constant.Separator;
            input.tag = input.tag.indexOf(Constant.SvgPrefix) === 0 ? input.tag.substr(Constant.SvgPrefix.length) : input.tag;
            let selector = prefix + input.tag + suffix;
            let id = Constant.Id in a && a[Constant.Id].length > 0 ? a[Constant.Id] : null;
            let classes = input.tag !== Constant.BodyTag && Constant.Class in a && a[Constant.Class].length > 0 ? a[Constant.Class].trim().split(/\s+/).filter(c => filter(c)).join(Constant.Period) : null;
            if (classes && classes.length > 0) {
                selector = prefix + input.tag + "." + classes + suffix;
            }
            // Update selector to use "id" field when available. There are two exceptions:
            // (1) if "id" appears to be an auto generated string token, e.g. guid or a random id containing digits
            // (2) if "id" appears inside a shadow DOM, in which case we continue to prefix up to shadow DOM to prevent conflicts
            selector = id && filter(id) ? getDomPrefix(prefix) + Constant.Hash + id : selector;
            return selector;
    }
}

function getDomPrefix(prefix: string): string {
  const shadowDomStart = prefix.lastIndexOf(Constant.ShadowDomTag);
  const iframeDomStart = prefix.lastIndexOf(Constant.IFramePrefix + Constant.HTML);
  const domStart = Math.max(shadowDomStart, iframeDomStart);
  
  if (domStart < 0) { return Constant.Empty; }

  return prefix.substring(0, prefix.indexOf(Constant.Separator, domStart) + 1);
}

// Check if the given input string has digits or excluded class names
function filter(value: string): boolean {
    if (!value) { return false; } // Do not process empty strings
    if (excludeClassNames.some(x => value.toLowerCase().includes(x))) { return false; }
    for (let i = 0; i < value.length; i++) {
        let c = value.charCodeAt(i);
        if (c >= Character.Zero && c <= Character.Nine) { return false };
    }
    return true;
}
