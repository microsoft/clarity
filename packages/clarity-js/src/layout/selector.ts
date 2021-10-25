import { Character, Setting } from "../../types/data";
import { Attributes, Constant } from "../../types/layout";

export default function(tag: string, prefix: string, attributes: Attributes, position: number, beta: boolean = false): string {
    let suffix = position ? `:nth-of-type(${position})` : Constant.Empty;
    switch (tag) {
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
            tag = tag.indexOf(Constant.SvgPrefix) === 0 ? tag.substr(Constant.SvgPrefix.length) : tag;
            let selector = `${prefix}${tag}${suffix}`;
            let classes = Constant.Class in attributes && attributes[Constant.Class].length > 0 ? attributes[Constant.Class].trim().split(/\s+/) : null;
            if (beta) {
                // In beta mode, update selector to use "id" field when available
                // The only exception is if "id" appears to be an auto generated string token, e.g. guid or a random id
                let id = Constant.Id in attributes && attributes[Constant.Id].length > 0 ? attributes[Constant.Id] : null;
                classes = tag !== Constant.BodyTag && classes ? classes.filter(c => !digits(c)) : [];
                selector = classes.length > 0 ? `${prefix}${tag}.${classes.join(".")}${suffix}` : selector;
                selector = id && digits(id) < Setting.AutoGenDigitThreshold ? `#${id}` : selector;
            } else {
                // Otherwise, fallback to stable mode, where we include class names as part of the selector
                selector = classes ? `${prefix}${tag}.${classes.join(".")}${suffix}` : selector;
            } 
            return selector;
    }
}

// Check if the given input string is an auto generated token or not
function digits(value: string): number {
    let result = 0;
    for (let i = 0; i < value.length; i++) {
        let c = value.charCodeAt(i);
        result += c >= Character.Zero && c <= Character.Nine ? 1 : 0; // Check for digits
    }
    return result;
}
