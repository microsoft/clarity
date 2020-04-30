import { Attributes, Constant } from "../../types/layout";

export default function(tag: string, prefix: string, attributes: Attributes, position: number): string {
    let suffix = position ? `:nth-of-type(${position})` : Constant.EMPTY_STRING;
    switch (tag) {
        case "STYLE":
        case "TITLE":
        case "LINK":
        case "META":
        case Constant.TEXT_TAG:
        case Constant.DOCUMENT_TAG:
            return Constant.EMPTY_STRING;
        case "HTML":
            return "HTML";
        default:
            if (prefix === null) { return Constant.EMPTY_STRING; }
            tag = tag.indexOf(Constant.SVG_PREFIX) === 0 ? tag.substr(Constant.SVG_PREFIX.length) : tag;
            let selector = `${prefix}${tag}${suffix}`;
            if (Constant.ID_ATTRIBUTE in attributes && attributes[Constant.ID_ATTRIBUTE].length > 0) {
                selector = `${tag}#${attributes.id}`;
            } else if (Constant.CLASS_ATTRIBUTE in attributes && attributes[Constant.CLASS_ATTRIBUTE].length > 0) {
                selector = `${prefix}${tag}.${attributes.class.trim().split(/\s+/).join(".")}${suffix}`;
            }
            return selector;
    }
}
