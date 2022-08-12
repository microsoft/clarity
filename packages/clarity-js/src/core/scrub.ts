import { Privacy } from "@clarity-types/core";
import * as Data from "@clarity-types/data";
import * as Layout from "@clarity-types/layout";

const catchallRegex = /\S/gi;
let unicodeRegex = true;
let digitRegex = null;
let letterRegex = null;
let currencyRegex = null;

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
                    case "click":
                    case "input":
                        return redact(value);
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
                    case "click":
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
    return value.replace(catchallRegex, Data.Constant.Mask);
}

function mangleToken(value: string): string {
    let length = ((Math.floor(value.length / Data.Setting.WordLength) + 1) * Data.Setting.WordLength);
    let output: string = Layout.Constant.Empty;
    for (let i = 0; i < length; i++) {
        output += i > 0 && i % Data.Setting.WordLength === 0 ? Data.Constant.Space : Data.Constant.Mask;
    }
    return output;
}

function redact(value: string): string {
    let spaceIndex = -1;
    let gap = 0;
    let hasDigit = false;
    let hasEmail = false;
    let hasWhitespace = false;
    let array = null;

    // Initialize unicode regex, if supported by the browser
    // Reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions/Unicode_Property_Escapes
    if (unicodeRegex && digitRegex === null) {
        try {
            digitRegex = new RegExp("\\p{N}", "gu");
            letterRegex = new RegExp("\\p{L}", "gu");
            currencyRegex = new RegExp("\\p{Sc}", "gu");
        } catch { unicodeRegex = false; }
    }

    for (let i = 0; i < value.length; i++) {
        let c = value.charCodeAt(i);
        hasDigit = hasDigit || (c >= Data.Character.Zero && c <= Data.Character.Nine); // Check for digits in the current word
        hasEmail = hasEmail || c === Data.Character.At; // Check for @ sign anywhere within the current word
        hasWhitespace = c === Data.Character.Tab || c === Data.Character.NewLine || c === Data.Character.Return || c === Data.Character.Blank;

        // Process each word as an individual token to redact any sensitive information
        if (i === 0 || i === value.length - 1 || hasWhitespace) {
            // Performance optimization: Lazy load string -> array conversion only when required
            if (hasDigit || hasEmail) {
                if (array === null) { array = value.split(Data.Constant.Empty); }
                // Work on a token at a time so we don't have to apply regex to a larger string
                let token = value.substring(spaceIndex + 1, hasWhitespace ? i : i + 1);
                // Check if unicode regex is supported, otherwise fallback to calling mask function on this token
                if (unicodeRegex && currencyRegex !== null) {
                    // Do not redact information if the token contains a currency symbol
                    token = token.match(currencyRegex) ? token : token.replace(letterRegex, Data.Constant.Letter).replace(digitRegex, Data.Constant.Digit);
                } else {
                    token = mask(token);
                }
                // Merge token back into array at the right place
                array.splice(spaceIndex + 1 - gap, token.length, token);
                gap += token.length - 1;
            }
            // Reset digit and email flags after every word boundary, except the beginning of string
            if (hasWhitespace) {
                hasDigit = false;
                hasEmail = false;
                spaceIndex = i;
            }
        }
    }
    return array ? array.join(Data.Constant.Empty) : value;
}
