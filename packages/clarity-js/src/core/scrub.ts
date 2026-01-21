import { Privacy } from "@clarity-types/core";
import * as Data from "@clarity-types/data";
import * as Layout from "@clarity-types/layout";
import config from "@src/core/config";

const catchallRegex = /\S/gi;
const maxUrlLength = 255;
let unicodeRegex = true;
let digitRegex = null;
let letterRegex = null;
let currencyRegex = null;

export function text(value: string, hint: string, privacy: Privacy, mangle: boolean = false, type?: string): string {
    if (value) {
        if (hint == "input" && (type === "checkbox" || type === "radio")) {
            return value;
        }

        switch (privacy) {
            case Privacy.None:
                return value;
            case Privacy.Sensitive:
                switch (hint) {
                    case Layout.Constant.TextTag:
                    case "value":
                    case "placeholder":
                    case "click":
                        return redact(value);
                    case "input":
                    case "change":
                        return mangleToken(value);
                }
                return value;
            case Privacy.Text:
            case Privacy.TextImage:
                switch (hint) {
                    case Layout.Constant.TextTag:
                    case Layout.Constant.DataAttribute:
                        return mangle ? mangleText(value) : mask(value);
                    case "src":
                    case "srcset":
                    case "title":
                    case "alt":
                    case "href":
                    case "xlink:href":
                        if (privacy === Privacy.TextImage) {
                            if (hint === 'src' && value?.startsWith('blob:')) {
                                return 'blob:';
                            }
                            return Data.Constant.Empty;
                        }
                        return value;
                    case "value":
                    case "click":
                    case "input":
                    case "change":
                        return mangleToken(value);
                    case "placeholder":
                        return mask(value);
                }
                break;
            case Privacy.Exclude:
                switch (hint) {
                    case Layout.Constant.TextTag:
                    case Layout.Constant.DataAttribute:
                        return mangle ? mangleText(value) : mask(value);
                    case "value":
                    case "input":
                    case "click":
                    case "change":
                        return Array(Data.Setting.WordLength).join(Data.Constant.Mask);
                    case "checksum":
                        return Data.Constant.Empty;
                }
                break;
            case Privacy.Snapshot:
                switch (hint) {
                    case Layout.Constant.TextTag:
                    case Layout.Constant.DataAttribute:
                        return scrub(value, Data.Constant.Letter, Data.Constant.Digit);
                    case "value":
                    case "input":
                    case "click":
                    case "change":
                        return Array(Data.Setting.WordLength).join(Data.Constant.Mask);
                    case "checksum":
                    case "src":
                    case "srcset":
                    case "alt":
                    case "title":
                        return Data.Constant.Empty;
                }
                break;
        }
    }
    return value;
}

export function url(input: string, electron: boolean = false, truncate: boolean = false): string {
    // Replace the URL for Electron apps so we don't send back file:/// URL
    if (electron) {
        return `${Data.Constant.HTTPS}${Data.Constant.Electron}`;
    }

    let drop = config.drop;
    let keep = config.keep;
    let hasDrop = drop?.length > 0;
    let hasKeep = keep?.length > 0;

    // Fast path: no processing needed
    if (!hasDrop && !hasKeep && !(truncate && input && input.length > maxUrlLength)) {
        return input;
    }

    // Only truncation needed, no drop/keep - use simple truncation
    if (!hasDrop && !hasKeep) {
        return truncateUrl(input);
    }

    let queryIndex = input ? input.indexOf("?") : -1;

    // No query string to process
    if (queryIndex <= 0) {
        return truncate && input && input.length > maxUrlLength ? input.substring(0, maxUrlLength) : input;
    }

    let path = input.substring(0, queryIndex);
    let queryAndHash = input.substring(queryIndex + 1);

    // Separate hash fragment from query string
    let hashIndex = queryAndHash.indexOf("#");
    let query = hashIndex >= 0 ? queryAndHash.substring(0, hashIndex) : queryAndHash;
    let hash = hashIndex >= 0 ? queryAndHash.substring(hashIndex) : "";

    // Empty query string
    if (query.length === 0) {
        return truncate && input.length > maxUrlLength ? input.substring(0, maxUrlLength) : input;
    }

    let params = query.split("&");
    let paramCount = params.length;

    // Process drop: replace sensitive parameter values
    if (hasDrop) {
        let swap = Data.Constant.Dropped;
        for (let i = 0; i < paramCount; i++) {
            let p = params[i];
            let eqIndex = p.indexOf("=");
            if (eqIndex > 0) {
                let key = p.substring(0, eqIndex);
                if (drop.indexOf(key) >= 0) {
                    params[i] = key + "=" + swap;
                }
            }
        }
    }

    // Process keep: move keep parameters to front (in-place reorder)
    if (hasKeep) {
        let writeIndex = 0;
        // First pass: move keep params to front
        for (let i = 0; i < paramCount; i++) {
            let p = params[i];
            let eqIndex = p.indexOf("=");
            let key = eqIndex > 0 ? p.substring(0, eqIndex) : p;
            if (keep.indexOf(key) >= 0) {
                if (i !== writeIndex) {
                    // Swap with position at writeIndex
                    let temp = params[writeIndex];
                    params[writeIndex] = p;
                    params[i] = temp;
                }
                writeIndex++;
            }
        }
    }

    // Build result - if truncation needed and result would be too long, use smart truncation
    if (truncate) {
        // Estimate: path + "?" + params joined + hash
        let estimatedLength = path.length + 1 + query.length + hash.length;
        if (estimatedLength > maxUrlLength) {
            return truncateParams(path, params, paramCount);
        }
    }

    return path + "?" + params.join("&") + hash;
}

// Truncates URL by adding complete parameters until max length is reached
function truncateParams(path: string, params: string[], paramCount: number): string {
    // If path alone exceeds max length, just truncate
    if (path.length >= maxUrlLength) {
        return path.substring(0, maxUrlLength);
    }

    let result = path;
    let len = path.length;

    for (let i = 0; i < paramCount; i++) {
        let separator = i === 0 ? "?" : "&";
        let paramLen = params[i].length;
        let newLen = len + 1 + paramLen; // +1 for separator

        if (newLen <= maxUrlLength) {
            result = result + separator + params[i];
            len = newLen;
        } else {
            break;
        }
    }

    return result;
}

// Simple truncation for URLs without drop/keep processing
function truncateUrl(input: string): string {
    let queryIndex = input.indexOf("?");

    // No query string, just truncate
    if (queryIndex < 0) {
        return input.substring(0, maxUrlLength);
    }

    let path = input.substring(0, queryIndex);

    // If path alone exceeds max length, just truncate
    if (path.length >= maxUrlLength) {
        return input.substring(0, maxUrlLength);
    }

    let queryAndHash = input.substring(queryIndex + 1);
    let hashIndex = queryAndHash.indexOf("#");
    let query = hashIndex >= 0 ? queryAndHash.substring(0, hashIndex) : queryAndHash;

    if (query.length === 0) {
        return path.substring(0, maxUrlLength);
    }

    let params = query.split("&");
    return truncateParams(path, params, params.length);
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

export function scrub(value: string, letter: string, digit: string): string {
    regex(); // Initialize regular expressions
    return value ? value.replace(letterRegex, letter).replace(digitRegex, digit) : value;
}

function mangleToken(value: string): string {
    let length = ((Math.floor(value.length / Data.Setting.WordLength) + 1) * Data.Setting.WordLength);
    let output: string = Layout.Constant.Empty;
    for (let i = 0; i < length; i++) {
        output += i > 0 && i % Data.Setting.WordLength === 0 ? Data.Constant.Space : Data.Constant.Mask;
    }
    return output;
}

function regex(): void {
    // Initialize unicode regex, if supported by the browser
    // Reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions/Unicode_Property_Escapes
    if (unicodeRegex && digitRegex === null) {
        try {
            digitRegex = new RegExp("\\p{N}", "gu");
            letterRegex = new RegExp("\\p{L}", "gu");
            currencyRegex = new RegExp("\\p{Sc}", "gu");
        } catch { unicodeRegex = false; }
    }
}

function redact(value: string): string {
    let spaceIndex = -1;
    let gap = 0;
    let hasDigit = false;
    let hasEmail = false;
    let hasWhitespace = false;
    let array = null;

    regex(); // Initialize regular expressions

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
                    token = token.match(currencyRegex) ? token : scrub(token, Data.Constant.Letter, Data.Constant.Digit);
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
