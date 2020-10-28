import { Privacy } from "@clarity-types/core";
import * as Data from "@clarity-types/data";
import * as Layout from "@clarity-types/layout";

export default function(value: string, hint: string, privacy: Privacy, mangle: boolean = false): string {
    if (value) {
        switch (privacy) {
            case Privacy.None:
                return value;
            case Privacy.Sensitive:
                switch (hint) {
                    case Layout.Constant.TextTag:
                    case "value":
                    case "placeholder":
                        return redact(value);
                    case "input":
                        return mangleToken(value);
                }
                return value;
            case Privacy.Text:
            case Privacy.TextImage:
                switch (hint) {
                    case Layout.Constant.TextTag:
                        return mangle ? mangleText(value) : mask(value);
                    case "src":
                    case "srcset":
                    case "title":
                    case "alt":
                        return privacy === Privacy.TextImage ? Data.Constant.Empty : value;
                    case "value":
                    case "input":
                        return mangleToken(value);
                    case "placeholder":
                        return mask(value);
                }
                break;
        }
    }
    return value;
}

function mangleText(value: string): string {
    let trimmed = value.trim();
    if (trimmed.length > 0) {
        let first = trimmed[0];
        let index = value.indexOf(first);
        let prefix = value.substr(0, index);
        let suffix = value.substr(index + trimmed.length);
        return `${prefix}${trimmed.length.toString(36)}${suffix}`;
    }
    return value;
}

function mask(value: string): string {
    return value.replace(/\S/gi, Data.Constant.Mask);
}

function mangleToken(value: string): string {
    return Array(((Math.floor(value.length / 5) + 1) * 5)).join(Data.Constant.Mask);
}

function redact(value: string): string {
    if(/\d/.test(value)) {
        let length = value.length;
        let digits = length - value.replace(/\d/g,"").length;
        return ((digits * 100) / length) > 30 ? mask(value) : value.replace(/\d/g,Data.Constant.Mask);
    } else if (value.indexOf("@") > 0) {
        return mask(value);
    }
    return value;
}
