import { expect, test } from "@playwright/test";
import { resolve } from "path";
import {
    HoverTransformationSummary,
    transformHoverRules,
    transformHoverSelector
} from "@src/hover";

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

    for (const name of ["not", "is", "where"]) {
        test(`preserves pseudo-element hover in ${name} functions and their branches`, () => {
            const input = `::part(tab):${name}(:hover, :not(:hover), :where(:hover, :hover))`;
            const result = transformHoverSelector(input);

            expect(result).toEqual({ selector: input, hover: 4, transformed: 0, unsupported: 4 });
        });
    }

    test("restores element context after pseudo-element logical functions", () => {
        const result = transformHoverSelector("::part(tab):not(:hover) .child:hover, .card:is(:hover, :hover)");

        expect(result).toEqual({
            selector: "::part(tab):not(:hover) .child[clarity-hover], .card:is([clarity-hover], [clarity-hover])",
            hover: 4, transformed: 3, unsupported: 1
        });
    });

    test("keeps slotted selector arguments in element context and restores the outer pseudo-element", () => {
        const result = transformHoverSelector("::slotted(.item:is(:hover, :not(:hover))):where(:hover)");

        expect(result).toEqual({
            selector: "::slotted(.item:is([clarity-hover], :not([clarity-hover]))):where(:hover)",
            hover: 3, transformed: 2, unsupported: 1
        });
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
    test("preserves pseudo-element logical rules and counts mixed rules as partially transformed", () => {
        const original = style("::part(tab):not(:hover)", "color: red;");
        const sheet = container([
            original,
            style(".card:hover, ::part(tab):is(:hover)", "color: blue;")
        ]);

        const summary = transformHoverRules(sheet);

        expect(sheet.cssRules[0]).toBe(original);
        expect(selectors(sheet)).toEqual([
            "::part(tab):not(:hover)",
            ".card[clarity-hover], ::part(tab):is(:hover)"
        ]);
        expect(summary).toMatchObject({ scanned: 2, hover: 2, transformed: 0, partial: 1, unsupported: 1 });
    });

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
        expect(summary).toMatchObject({ scanned: 2, hover: 2, transformed: 2, unsupported: 0 });
    });

    test("retains a rejected scope boundary and still transforms its nested rules", () => {
        const scope = Object.assign(grouping(0, [style(".target:hover", "color: red;")]), {
            start: ".root:hover",
            end: ".stop:hover"
        });
        const sheet = container([scope], "@scope (.root[clarity-hover]) to (.stop[clarity-hover])");
        const errors: Error[] = [];

        const summary = transformHoverRules(sheet, (error: Error): void => { errors.push(error); });

        expect(sheet.cssRules[0]).toBe(scope);
        expect(scope.start).toBe(".root:hover");
        expect(scope.end).toBe(".stop:hover");
        expect(selectors(scope)).toEqual([".target[clarity-hover]"]);
        expect(summary).toMatchObject({ scanned: 2, hover: 2, transformed: 1, insertionFailed: 1 });
        expect(errors).toHaveLength(1);
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
        const sheet = container([
            style(".first:hover", "color: blue;"),
            rejected,
            style(".last:hover", "color: green;")
        ], ".rejected[clarity-hover]");
        const errors: Error[] = [];

        const summary = transformHoverRules(sheet, (error: Error): void => { errors.push(error); });

        expect(selectors(sheet)).toEqual([".first[clarity-hover]", ".rejected:hover", ".last[clarity-hover]"]);
        expect(sheet.cssRules[1]).toBe(rejected);
        expect(summary).toMatchObject({ scanned: 3, hover: 3, transformed: 2, insertionFailed: 1 });
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe("Rejected test selector");
    });

    test("retains parser failures and transforms valid candidates", () => {
        const invalid = style(".invalid:hover[", "color: red;");
        const sheet = container([
            style(".first:hover", "color: blue;"),
            invalid,
            style(".last:hover", "color: green;")
        ]);
        const errors: Error[] = [];

        const summary = transformHoverRules(sheet, (error: Error): void => { errors.push(error); });

        expect(selectors(sheet)).toEqual([".first[clarity-hover]", ".invalid:hover[", ".last[clarity-hover]"]);
        expect(sheet.cssRules[1]).toBe(invalid);
        expect(summary).toMatchObject({ scanned: 3, hover: 2, transformed: 2, parseFailed: 1 });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toBeInstanceOf(Error);
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

        const errors: Error[] = [];
        const summary = transformHoverRules(sheet, (error: Error): void => { errors.push(error); });

        expect(summary).toEqual<HoverTransformationSummary>({
            scanned: 6,
            hover: 4,
            transformed: 1,
            partial: 1,
            unsupported: 1,
            parseFailed: 1,
            insertionFailed: 1
        });
        expect(errors).toHaveLength(2);
    });
});

test("preserves real pseudo-element hover styling while transforming slotted element hover", async ({ page }) => {
    await page.addScriptTag({ path: resolve(__dirname, "..", "build", "clarity.visualize.min.js") });
    const original = await page.evaluate(() => {
        const host = document.createElement("div");
        host.innerHTML = "<span class='item'>Slotted</span>";
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: "open" });
        shadow.innerHTML = "<button part='tab'>Hover me</button><slot></slot>";
        const styleElement = document.createElement("style");
        styleElement.textContent = [
            "::part(tab) { color: rgb(255, 0, 0); }",
            "::part(tab):is(:hover) { color: rgb(0, 0, 255); }",
            "::part(tab):not(:hover) { background-color: rgb(0, 255, 0); }",
            "::part(tab):where(:hover) { background-color: rgb(0, 0, 255); }"
        ].join("\n");
        document.head.appendChild(styleElement);
        return styleElement.textContent;
    });
    const button = page.locator("button");
    await button.hover();
    await expect(button).toHaveCSS("color", "rgb(0, 0, 255)");
    await expect(button).toHaveCSS("background-color", "rgb(0, 0, 255)");

    const selectorsAfter = await page.evaluate(async (css: string) => {
        const api = (window as Window & { clarity: { visualize: typeof import("@src/clarity") } }).clarity.visualize;
        const visualizer = await api.setup(window, { version: "0.8.72" });
        const layout = visualizer.layout;
        layout.nodes[1] = document.head;
        layout.nodes[2] = document.querySelector("style");
        layout.nodes[3] = document.querySelector("body > div").shadowRoot;
        layout.markup({ event: 6, time: 0, data: [
            { id: 2, parent: 1, previous: null, tag: "STYLE", value: css },
            { id: 4, parent: 3, previous: null, tag: "STYLE",
                value: "::slotted(.item:is(:hover)) { color: rgb(0, 128, 0); }" }
        ] });
        document.querySelector(".item").setAttribute("clarity-hover", "");
        const sheet = (layout.nodes[2] as HTMLStyleElement).sheet as CSSStyleSheet;
        return Array.from(sheet.cssRules, (entry: CSSStyleRule): string => entry.selectorText);
    }, original);

    expect(selectorsAfter).toEqual([
        "::part(tab)", "::part(tab):is(:hover)", "::part(tab):not(:hover)", "::part(tab):where(:hover)"
    ]);
    await expect(button).toHaveCSS("color", "rgb(0, 0, 255)");
    await expect(button).toHaveCSS("background-color", "rgb(0, 0, 255)");
    await expect(page.locator(".item")).toHaveCSS("color", "rgb(0, 128, 0)");
    await page.mouse.move(1000, 1000);
    await expect(button).toHaveCSS("background-color", "rgb(0, 255, 0)");
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
