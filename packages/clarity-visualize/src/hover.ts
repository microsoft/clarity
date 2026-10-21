import type { ErrorLogger } from "@clarity-types/visualize";
import type { HoverTransformationSummary } from "@clarity-types/visualize";
export type { HoverTransformationSummary } from "@clarity-types/visualize";

const Hover = "hover";
const HoverAttribute = "clarity-hover";
const MaxNestingDepth = 128;
const MaxSelectorLength = 65536;
const StyleRule = 1;
const ImportRule = 3;

export interface HoverSelectorResult {
    selector: string;
    hover: number;
    transformed: number;
    unsupported: number;
}

interface RuleList {
    readonly length: number;
    readonly [index: number]: Rule;
}

interface Rule {
    readonly type: number;
    readonly cssText: string;
    selectorText?: string;
    start?: string;
    end?: string;
    cssRules?: RuleList;
    styleSheet?: RuleContainer;
    insertRule?: (rule: string, index?: number) => number;
    deleteRule?: (index: number) => void;
}

interface Identifier {
    end: number;
    value: string;
}

interface Escape {
    end: number;
    value: string;
}

interface SelectorContext {
    pseudoElement: boolean;
    inheritedPseudoElement: boolean;
}

export interface RuleContainer {
    readonly cssRules: RuleList;
    insertRule(rule: string, index?: number): number;
    deleteRule(index: number): void;
}

export function transformHoverSelector(input: string): HoverSelectorResult {
    return new SelectorParser(input).parse();
}

export function transformHoverRules(container: RuleContainer, logerror?: ErrorLogger): HoverTransformationSummary {
    const summary = emptySummary();
    transformRules(container, summary, logerror);
    return summary;
}

class SelectorParser {
    private index: number = 0;
    private output: string[] = [];
    private contexts: SelectorContext[] = [{ pseudoElement: false, inheritedPseudoElement: false }];
    private hover: number = 0;
    private transformed: number = 0;
    private unsupported: number = 0;

    constructor(private input: string) {
        if (input.length > MaxSelectorLength) {
            throw new Error("Selector exceeds maximum length");
        }
    }

    public parse(): HoverSelectorResult {
        while (this.index < this.input.length) {
            const value = this.input[this.index];
            if (value === "/" && this.input[this.index + 1] === "*") {
                this.copyComment();
            } else if (value === "\"" || value === "'") {
                this.copyString(value);
            } else if (value === "\\") {
                this.copyEscape();
            } else if (value === "[") {
                this.copyAttribute();
            } else if (value === "]") {
                throw new Error("Unexpected closing bracket");
            } else if (value === "(") {
                this.openFunction();
            } else if (value === ")") {
                this.closeFunction();
            } else if (value === ":") {
                this.parsePseudo();
            } else if (value === ",") {
                this.copy(value);
                this.resetCompound();
            } else if (isWhitespace(value) || this.isCombinator()) {
                this.copy(value);
                this.resetCompound();
            } else if (value === "{" || value === "}" || value === ";") {
                throw new Error("Unexpected selector delimiter");
            } else {
                this.copy(value);
            }
        }

        if (this.contexts.length !== 1) {
            throw new Error("Unclosed function");
        }

        return {
            selector: this.transformed > 0 ? this.output.join("") : this.input,
            hover: this.hover,
            transformed: this.transformed,
            unsupported: this.unsupported
        };
    }

    private parsePseudo(): void {
        const start = this.index;
        let colonCount = 1;
        if (this.input[this.index + 1] === ":") {
            colonCount++;
        }

        const identifier = this.readIdentifier(start + colonCount);
        if (identifier.end === start + colonCount) {
            throw new Error("Pseudo selector has no name");
        }

        const name = identifier.value.toLowerCase();
        const functional = this.input[identifier.end] === "(";
        this.index = identifier.end;

        if (colonCount === 1 && name === Hover && !functional) {
            this.hover++;
            if (this.currentPseudoElement()) {
                // Preserve pseudo-element hover: the replay attribute can only target DOM elements.
                this.output.push(this.input.substring(start, identifier.end));
                this.unsupported++;
            } else {
                this.output.push(`[${HoverAttribute}]`);
                this.transformed++;
            }
        } else {
            this.output.push(this.input.substring(start, identifier.end));
        }

        if (colonCount === 2 || isLegacyPseudoElement(name)) {
            this.contexts[this.contexts.length - 1].pseudoElement = true;
        }

        if (functional) {
            const logical = colonCount === 1 && (name === "not" || name === "is" || name === "where");
            this.openFunction(logical && this.currentPseudoElement());
        }
    }

    private readIdentifier(start: number): Identifier {
        let end = start;
        let value = "";
        while (end < this.input.length) {
            const current = this.input[end];
            if (isNameCharacter(current)) {
                value += current;
                end++;
            } else if (current === "\\") {
                const escape = this.readEscape(end);
                value += escape.value;
                end = escape.end;
            } else {
                break;
            }
        }
        return { end, value };
    }

    private readEscape(start: number): Escape {
        let end = start + 1;
        if (end >= this.input.length || isNewline(this.input[end])) {
            throw new Error("Invalid selector escape");
        }

        if (!isHex(this.input[end])) {
            return { end: end + 1, value: this.input[end] };
        }

        const hexStart = end;
        while (end < this.input.length && end - hexStart < 6 && isHex(this.input[end])) {
            end++;
        }
        const codePoint = parseInt(this.input.substring(hexStart, end), 16);
        if (end < this.input.length && isWhitespace(this.input[end])) {
            end += this.input[end] === "\r" && this.input[end + 1] === "\n" ? 2 : 1;
        }
        const valid = codePoint > 0 && codePoint <= 0x10FFFF && !(codePoint >= 0xD800 && codePoint <= 0xDFFF);
        return { end, value: valid ? String.fromCodePoint(codePoint) : "\uFFFD" };
    }

    private copyEscape(): void {
        const escape = this.readEscape(this.index);
        this.output.push(this.input.substring(this.index, escape.end));
        this.index = escape.end;
    }

    private copyComment(): void {
        const start = this.index;
        this.skipComment("selector");
        this.output.push(this.input.substring(start, this.index));
    }

    private copyString(quote: string): void {
        const start = this.index;
        this.skipString(quote, "selector");
        this.output.push(this.input.substring(start, this.index));
    }

    private copyAttribute(): void {
        const start = this.index++;
        let depth = 1;
        while (this.index < this.input.length) {
            const current = this.input[this.index];
            if (current === "\"" || current === "'") {
                this.skipString(current, "attribute");
            } else if (current === "/" && this.input[this.index + 1] === "*") {
                this.skipComment("attribute");
            } else if (current === "\\") {
                this.index = this.readEscape(this.index).end;
            } else {
                this.index++;
                if (current === "[") {
                    depth++;
                } else if (current === "]" && --depth === 0) {
                    this.output.push(this.input.substring(start, this.index));
                    return;
                }
            }
        }
        throw new Error("Unclosed attribute selector");
    }

    private skipString(quote: string, context: string): void {
        this.index++;
        while (this.index < this.input.length) {
            const current = this.input[this.index];
            if (current === quote) {
                this.index++;
                return;
            }
            if (current === "\\") {
                if (isNewline(this.input[this.index + 1])) {
                    this.index += this.input[this.index + 1] === "\r" &&
                        this.input[this.index + 2] === "\n" ? 3 : 2;
                } else {
                    this.index = this.readEscape(this.index).end;
                }
            } else {
                if (isNewline(current)) {
                    throw new Error(`Unclosed ${context} string`);
                }
                this.index++;
            }
        }
        throw new Error(`Unclosed ${context} string`);
    }

    private skipComment(context: string): void {
        const end = this.input.indexOf("*/", this.index + 2);
        if (end < 0) {
            throw new Error(`Unclosed ${context} comment`);
        }
        this.index = end + 2;
    }

    private openFunction(pseudoElement: boolean = false): void {
        if (this.contexts.length >= MaxNestingDepth) {
            throw new Error("Selector exceeds maximum nesting depth");
        }
        this.copy("(");
        this.contexts.push({ pseudoElement, inheritedPseudoElement: pseudoElement });
    }

    private closeFunction(): void {
        if (this.contexts.length === 1) {
            throw new Error("Unexpected closing parenthesis");
        }
        this.copy(")");
        this.contexts.pop();
    }

    private isCombinator(): boolean {
        const value = this.input[this.index];
        return value === ">" || value === "+" || value === "~" ||
            (value === "|" && this.input[this.index + 1] === "|");
    }

    private currentPseudoElement(): boolean {
        return this.contexts[this.contexts.length - 1].pseudoElement;
    }

    private resetCompound(): void {
        const context = this.contexts[this.contexts.length - 1];
        context.pseudoElement = context.inheritedPseudoElement;
    }

    private copy(value: string): void {
        this.output.push(value);
        this.index++;
    }
}

function transformRules(container: RuleContainer, summary: HoverTransformationSummary, logerror?: ErrorLogger): void {
    for (let i = container.cssRules.length - 1; i >= 0; i--) {
        let rule = container.cssRules[i];
        if (rule.type === StyleRule && rule.selectorText !== undefined) {
            rule = transformRule(container, rule, i, rule.selectorText, summary, logerror);
        } else if (rule.start !== undefined && rule.end !== undefined && isRuleContainer(rule)) {
            // Scope boundaries are selectors, but are not exposed through selectorText.
            const selector = "@scope" + (rule.start === null ? "" : ` (${rule.start})`) +
                (rule.end === null ? "" : ` to (${rule.end})`);
            rule = transformRule(container, rule, i, selector, summary, logerror);
        }
        if (isRuleContainer(rule)) {
            transformRules(rule, summary, logerror);
        } else if (rule.type === ImportRule) {
            try {
                const styleSheet = rule.styleSheet;
                if (styleSheet) { transformRules(styleSheet, summary, logerror); }
            } catch (error) {
                // Ignore imported stylesheets whose CSSOM is not readable.
            }
        }
    }
}

function transformRule(
    container: RuleContainer,
    original: Rule,
    index: number,
    selector: string,
    summary: HoverTransformationSummary,
    logerror?: ErrorLogger
): Rule {
    summary.scanned++;
    if (selector.toLowerCase().indexOf(":hover") < 0 && selector.indexOf("\\") < 0) {
        return original;
    }

    let result: HoverSelectorResult;
    try {
        result = transformHoverSelector(selector);
    } catch (error) {
        summary.parseFailed++;
        if (logerror) { logerror(error); }
        return original;
    }

    if (result.hover === 0) { return original; }
    summary.hover++;

    if (result.transformed === 0) {
        summary.unsupported++;
        return original;
    }

    let candidate: Rule = null;
    try {
        let css = result.selector;
        if (original.type === StyleRule) {
            css += original.cssText.substring(selector.length);
        } else {
            css += " {";
            for (let i = 0; i < original.cssRules.length; i++) {
                css += original.cssRules[i].cssText;
            }
            css += "}";
        }
        // Insert before deleting so a rejected replacement leaves the original rule intact.
        container.insertRule(css, index + 1);
        candidate = container.cssRules[index + 1];
        container.deleteRule(index);
        if (result.unsupported > 0) {
            summary.partial++;
        } else {
            summary.transformed++;
        }
        return candidate;
    } catch (error) {
        if (candidate && container.cssRules[index + 1] === candidate) {
            container.deleteRule(index + 1);
        }
        summary.insertionFailed++;
        if (logerror) { logerror(error); }
        return original;
    }
}

function isNameCharacter(value: string): boolean {
    if (!value) { return false; }
    const code = value.charCodeAt(0);
    return code >= 0x80 || value === "-" || value === "_" ||
        code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122;
}

function isLegacyPseudoElement(value: string): boolean {
    return value === "after" || value === "before" || value === "first-letter" || value === "first-line";
}

function isHex(value: string): boolean {
    if (!value) { return false; }
    const code = value.charCodeAt(0);
    return code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102;
}

function isWhitespace(value: string): boolean {
    return value === " " || value === "\t" || value === "\n" || value === "\r" || value === "\f";
}

function isNewline(value: string): boolean {
    return value === "\n" || value === "\r" || value === "\f";
}

function isRuleContainer(rule: Rule): rule is Rule & RuleContainer {
    return rule.cssRules !== undefined && rule.insertRule !== undefined && rule.deleteRule !== undefined;
}

function emptySummary(): HoverTransformationSummary {
    return {
        scanned: 0,
        hover: 0,
        transformed: 0,
        partial: 0,
        unsupported: 0,
        parseFailed: 0,
        insertionFailed: 0
    };
}
