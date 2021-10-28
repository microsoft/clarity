import { Character } from "../../types/data";
import { Constant, Selector, SelectorInput } from "../../types/layout";

const TAGS = ["DIV", "TR", "P", "LI", "UL", "A", "BUTTON"];

export default function(input: SelectorInput, beta: boolean = false): string {
    let a = input.attributes;
    let prefix = input.prefix ? input.prefix[beta ? Selector.Beta : Selector.Stable] : null;
    let suffix = beta || ((a && !(Constant.Class in a)) || TAGS.indexOf(input.tag) >= 0) ? `:nth-of-type(${input.position})` : Constant.Empty;
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
            prefix = `${prefix}>`;
            input.tag = input.tag.indexOf(Constant.SvgPrefix) === 0 ? input.tag.substr(Constant.SvgPrefix.length) : input.tag;
            let selector = `${prefix}${input.tag}${suffix}`;
            let classes = Constant.Class in a && a[Constant.Class].length > 0 ? a[Constant.Class].trim().split(/\s+/) : null;
            if (beta) {
                // In beta mode, update selector to use "id" field when available
                // The only exception is if "id" appears to be an auto generated string token, e.g. guid or a random id
                let id = Constant.Id in a && a[Constant.Id].length > 0 ? a[Constant.Id] : null;
                classes = input.tag !== Constant.BodyTag && classes ? classes.filter(c => !hasDigits(c)) : [];
                selector = classes.length > 0 ? `${prefix}${input.tag}.${classes.join(".")}${suffix}` : selector;
                selector = id && hasDigits(id) === false ? `#${id}` : selector;
            } else {
                // Otherwise, fallback to stable mode, where we include class names as part of the selector
                selector = classes ? `${prefix}${input.tag}.${classes.join(".")}${suffix}` : selector;
            } 
            return selector;
    }
}

// Check if the given input string has digits or not
function hasDigits(value: string): boolean {
    for (let i = 0; i < value.length; i++) {
        let c = value.charCodeAt(i);
        return c >= Character.Zero && c <= Character.Nine;
    }
    return false;
}
