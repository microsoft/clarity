import { expect, test } from "@playwright/test";
import {
    HoverTransformationSummary,
    transformHoverRules,
    transformHoverSelector
} from "../src/hover";

test.describe("hover selector transformation", () => {
    test("transforms a standard hover selector", () => {
        const result = transformHoverSelector(".menu:hover .submenu");

        expect(result.selector).toBe(".menu[clarity-hover] .submenu");
        expect(result).toMatchObject({ hover: 1, transformed: 1, unsupported: 0 });
    });

    test("transforms selector lists and multiple hover pseudo-classes", () => {
        const result = transformHoverSelector(".menu:hover:hover, button:hover .icon:hover");

        expect(result.selector).toBe(".menu[clarity-hover][clarity-hover], button[clarity-hover] .icon[clarity-hover]");
        expect(result).toMatchObject({ hover: 4, transformed: 4, unsupported: 0 });
    });

    test("does not transform hover text in an escaped utility class", () => {
        const result = transformHoverSelector(".hover\\:enabled:hover");

        expect(result.selector).toBe(".hover\\:enabled[clarity-hover]");
        expect(result).toMatchObject({ hover: 1, transformed: 1, unsupported: 0 });
    });

    test("decodes escaped pseudo-class names", () => {
        const result = transformHoverSelector(".menu:\\68 over");

        expect(result.selector).toBe(".menu[clarity-hover]");
        expect(result).toMatchObject({ hover: 1, transformed: 1, unsupported: 0 });
    });

    test("preserves hover text in attributes, strings, and comments", () => {
        const input = "[data-state/* :hover */=':hover']:lang('en')/* :hover */.item:hover";
        const result = transformHoverSelector(input);

        expect(result.selector).toBe("[data-state/* :hover */=':hover']:lang('en')/* :hover */.item[clarity-hover]");
        expect(result).toMatchObject({ hover: 1, transformed: 1, unsupported: 0 });
    });

    test("preserves unsupported pseudo-element hover selectors", () => {
        const result = transformHoverSelector("button:hover::before, ::-webkit-scrollbar-thumb:hover");

        expect(result.selector).toBe("button[clarity-hover]::before, ::-webkit-scrollbar-thumb:hover");
        expect(result).toMatchObject({ hover: 2, transformed: 1, unsupported: 1 });
    });

    test("transforms hover selectors in functional pseudo-classes", () => {
        const result = transformHoverSelector(".item:is(:hover, :not(.disabled:hover)):has(.child:hover)");

        expect(result.selector).toBe(
            ".item:is([clarity-hover], :not(.disabled[clarity-hover])):has(.child[clarity-hover])"
        );
        expect(result).toMatchObject({ hover: 3, transformed: 3, unsupported: 0 });
    });

    test("rejects malformed and deeply nested selectors", () => {
        const nested = `${":not(".repeat(128)}:hover${")".repeat(128)}`;

        expect(() => transformHoverSelector(".invalid:hover[")).toThrow();
        expect(() => transformHoverSelector(".invalid:hover)")).toThrow();
        expect(() => transformHoverSelector(nested)).toThrow();

        expect(() => transformHoverSelector(".item:hover[data-state='unclosed]")).toThrow();
        expect(() => transformHoverSelector(".item:hover/* unclosed")).toThrow();
    });
});

test.describe("hover stylesheet transformation", () => {
    test("visits nested media, supports, and layer rules without changing their order", () => {
        const media = grouping(4, [style(".media:hover", "color: red;")]);
        const supports = grouping(12, [style(".supports:hover", "display: grid;")]);
        const layer = grouping(0, [style(".layer:hover", "color: blue;")]);
        const sheet = container([media, supports, layer]);

        const summary = transformHoverRules(sheet);

        expect(selectors(media)).toEqual([".media[clarity-hover]"]);
        expect(selectors(supports)).toEqual([".supports[clarity-hover]"]);
        expect(selectors(layer)).toEqual([".layer[clarity-hover]"]);
        expect(sheet.cssRules).toEqual([media, supports, layer]);
        expect(summary).toMatchObject({ scanned: 3, hover: 3, transformed: 3 });
    });

    test("visits style rules nested inside other style rules", () => {
        const nested = grouping(1, [style("&:hover", "color: red;")], ".card");
        const sheet = container([nested]);

        const summary = transformHoverRules(sheet);

        expect(selectors(nested)).toEqual(["&[clarity-hover]"]);
        expect(summary).toMatchObject({ scanned: 2, hover: 1, transformed: 1 });
    });

    test("visits readable imported stylesheets and contains inaccessible imports", () => {
        const imported = container([style(".imported:hover", "color: red;")]);
        const opaque = container([]);
        Object.defineProperty(opaque, "cssRules", {
            get(): MockRule[] { throw new Error("SecurityError"); }
        });
        const sheet = container([
            inaccessibleImport(),
            importedRule(imported),
            importedRule(opaque),
            style(".local:hover", "color: blue;")
        ]);

        const summary = transformHoverRules(sheet);

        expect(selectors(imported)).toEqual([".imported[clarity-hover]"]);
        expect(selectors(sheet).slice(3)).toEqual([".local[clarity-hover]"]);
        expect(summary).toMatchObject({ scanned: 2, hover: 2, transformed: 2, unsupported: 2 });
    });

    test("does not modify declarations, URLs, strings, comments, font faces, or keyframes", () => {
        const declaration = [
            "background: url(https://example.com/:hover.png);",
            "content: ':hover';",
            "--state: ':hover';",
            "/* :hover */ color: red;"
        ].join(" ");
        const hover = style(".target:hover", declaration);
        const fontFace = rule(5, "@font-face { font-family: ':hover'; src: url(font:hover.woff2); }");
        const keyframes = grouping(7, [rule(8, "from { content: ':hover'; }")]);
        const sheet = container([hover, fontFace, keyframes]);

        transformHoverRules(sheet);

        expect((sheet.cssRules[0] as MockStyleRule).selectorText).toBe(".target[clarity-hover]");
        expect(sheet.cssRules[0].cssText).toContain(declaration);
        expect(sheet.cssRules[1]).toBe(fontFace);
        expect(sheet.cssRules[2]).toBe(keyframes);
        expect(keyframes.cssRules[0].cssText).toBe("from { content: ':hover'; }");
    });

    test("retains a rule rejected during insertion and continues with subsequent rules", () => {
        const rejected = style(".rejected:hover", "color: red;");
        const accepted = style(".accepted:hover", "color: blue;");
        const sheet = container([rejected, accepted], ".rejected[clarity-hover]");

        const summary = transformHoverRules(sheet);

        expect(selectors(sheet)).toEqual([".rejected:hover", ".accepted[clarity-hover]"]);
        expect(summary).toMatchObject({ scanned: 2, hover: 2, transformed: 1, insertionFailed: 1 });
    });

    test("retains parser failures and transforms valid candidates", () => {
        const invalid = style(".invalid:hover[", "color: red;");
        const valid = style(".valid:hover", "color: blue;");
        const sheet = container([invalid, valid]);

        const summary = transformHoverRules(sheet);

        expect(selectors(sheet)).toEqual([".invalid:hover[", ".valid[clarity-hover]"]);
        expect(summary).toMatchObject({ scanned: 2, hover: 1, transformed: 1, parseFailed: 1 });
    });

    test("does not skip the rule following a successful replacement", () => {
        const sheet = container([
            style(".first:hover", "color: red;"),
            style(".second:hover", "color: blue;"),
            style(".third:hover", "color: green;")
        ]);

        const summary = transformHoverRules(sheet);

        expect(selectors(sheet)).toEqual([
            ".first[clarity-hover]",
            ".second[clarity-hover]",
            ".third[clarity-hover]"
        ]);
        expect(summary.transformed).toBe(3);
    });

    test("reports complete, partial, unsupported, parse, and insertion outcomes", () => {
        const sheet = container([
            style(".complete:hover", "color: red;"),
            style(".partial:hover, ::part(icon):hover", "color: blue;"),
            style("::-webkit-scrollbar-thumb:hover", "color: green;"),
            style(".invalid:hover[", "color: purple;"),
            style(".rejected:hover", "color: orange;"),
            style(".plain", "color: black;"),
            inaccessibleImport()
        ], ".rejected[clarity-hover]");

        const summary = transformHoverRules(sheet);

        expect(summary).toEqual<HoverTransformationSummary>({
            scanned: 6,
            hover: 4,
            transformed: 1,
            partial: 1,
            unsupported: 2,
            parseFailed: 1,
            insertionFailed: 1
        });
    });
});

interface MockRule {
    readonly type: number;
    readonly cssText: string;
    selectorText?: string;
    styleSheet?: MockContainer;
}

interface MockStyleRule extends MockRule {
    selectorText: string;
}

interface MockContainer {
    readonly cssRules: MockRule[];
    insertRule(cssText: string, index?: number): number;
    deleteRule(index: number): void;
}

interface MockGroupingRule extends MockRule, MockContainer {
}

function style(initialSelector: string, declaration: string): MockStyleRule {
    let selector = initialSelector;
    return {
        type: 1,
        get selectorText(): string {
            return selector;
        },
        set selectorText(value: string) {
            selector = value;
        },
        get cssText(): string {
            return `${selector} { ${declaration} }`;
        }
    };
}

function container(cssRules: MockRule[], rejectedSelector: string = null): MockContainer {
    return {
        cssRules,
        insertRule(cssText: string, index: number = cssRules.length): number {
            const open = cssText.indexOf("{");
            const selector = cssText.substring(0, open).trim();
            if (selector === rejectedSelector) {
                throw new Error("Rejected test selector");
            }
            const declaration = cssText.substring(open + 1, cssText.lastIndexOf("}")).trim();
            cssRules.splice(index, 0, style(selector, declaration));
            return index;
        },
        deleteRule(index: number): void {
            cssRules.splice(index, 1);
        }
    };
}

function grouping(type: number, rules: MockRule[], selectorText?: string): MockGroupingRule {
    const nested = container(rules);
    return {
        type,
        selectorText,
        cssRules: nested.cssRules,
        insertRule: nested.insertRule,
        deleteRule: nested.deleteRule,
        get cssText(): string {
            return selectorText ?
                `${selectorText} { ${rules.map(item => item.cssText).join(" ")} }` :
                `@group { ${rules.map(item => item.cssText).join(" ")} }`;
        }
    };
}

function importedRule(styleSheet: MockContainer): MockRule {
    return { type: 3, cssText: "@import url(imported.css);", styleSheet };
}

function inaccessibleImport(): MockRule {
    return {
        type: 3,
        cssText: "@import url(opaque.css);",
        get styleSheet(): MockContainer {
            throw new Error("SecurityError");
        }
    };
}

function rule(type: number, cssText: string): MockRule {
    return { type, cssText };
}

function selectors(ruleContainer: MockContainer): string[] {
    return ruleContainer.cssRules.map(item => item.selectorText);
}
