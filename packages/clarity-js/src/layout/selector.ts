import { Attributes, Constant } from "../../types/layout";

export default function(tag: string, prefix: string, attributes: Attributes, position: number): string {
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
            return "HTML";
        default:
            if (prefix === null) { return Constant.Empty; }
            tag = tag.indexOf(Constant.SvgPrefix) === 0 ? tag.substr(Constant.SvgPrefix.length) : tag;
            let selector = `${prefix}${tag}${suffix}`;
            if (Constant.Id in attributes && attributes[Constant.Id].length > 0) {
                selector = `${tag}#${attributes.id}`;
            } else if (Constant.Class in attributes && attributes[Constant.Class].length > 0) {
                selector = `${prefix}${tag}.${attributes.class.trim().split(/\s+/).join(".")}${suffix}`;
            }
            return selector;
    }
}
