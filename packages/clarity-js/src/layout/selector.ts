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
            if (beta) {
                // In beta mode, update selector to use "id" field when available
                // The only exception is if "id" appears to be an auto generated string token, e.g. guid or a random id
                let id = Constant.Id in attributes && attributes[Constant.Id].length > 0 ? attributes[Constant.Id] : null;
                selector = id && isAutoGen(id) === false ? `#${id}` : selector;
            } else {
                // Otherwise, fallback to stable mode, where we include class names as part of the selector
                let className = Constant.Class in attributes && attributes[Constant.Class].length > 0 ? attributes[Constant.Class] : null;
                selector = className ? `${prefix}${tag}.${className.trim().split(/\s+/).join(".")}${suffix}` : selector;
            } 
            return selector;
    }
}

// Check if the given input string is an auto generated token or not
function isAutoGen(value: string): boolean {
    let numbers = 0;
    for (let i = 0; i < value.length; i++) {
        let c = value.charCodeAt(i);
        numbers += c >= Character.Zero && c <= Character.Nine ? 1 : 0; // Check for digits
    }
    return numbers > Setting.AutoGenDigitThreshold;
}