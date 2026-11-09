import { expect, test } from "@playwright/test";
import type { Layout } from "clarity-decode";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { Visualizer } from "../src/visualizer";

declare global {
    interface Window {
        svgReplay: Visualizer;
    }
}

const bundle = readFileSync(resolve(__dirname, "../build/clarity.visualize.js"), "utf8");
const staticNodes: Layout.DomData[] = [
    { id: 1, parent: null, previous: null, tag: "HTML" },
    { id: 2, parent: 1, previous: null, tag: "BODY" },
    { id: 3, parent: 2, previous: null, tag: "svg:svg", attributes: { viewBox: "0 0 100 100" } },
    { id: 4, parent: 3, previous: null, tag: "svg:a", attributes: { id: "link", href: "#first" } },
    { id: 5, parent: 4, previous: null, tag: "svg:rect", attributes: { width: "20", height: "10", fill: "navy" } }
];
const animationTags = ["animate", "set", "animateColor", "animateMotion", "animateTransform", "discard", "ANIMATE", "s:set"];

test.use({ javaScriptEnabled: false, serviceWorkers: "block" });

test.beforeEach(async ({ page }): Promise<void> => {
    await page.route("**/*", (route) => route.abort());
    await page.evaluate(async (source: string): Promise<void> => {
        const exports = {} as { Visualizer: typeof Visualizer };
        new Function("exports", source)(exports);
        window.svgReplay = await new exports.Visualizer().setup(window, { version: "0.8.71", pointer: false, canvas: false });
    }, bundle);
});

for (const event of [5, 6]) {
    test(`keeps SVG animation nodes inert during ${event === 5 ? "discovery" : "mutations"}`, async ({ page }): Promise<void> => {
        const result = await page.evaluate(({ base, tags, eventType }) => {
            const layout = window.svgReplay.layout;
            const animations: Layout.DomData[] = tags.map((tag: string, index: number): Layout.DomData => ({
                id: 20 + index,
                parent: 4,
                previous: index === 0 ? 5 : 19 + index,
                tag: `svg:${tag}`,
                attributes: {
                    attributeName: index % 2 === 0 ? "href" : "xlink:href",
                    href: "#link",
                    "xlink:href": "#link",
                    from: "#first",
                    to: "#second",
                    values: "#first;#second",
                    begin: "indefinite"
                }
            }));
            const sibling: Layout.DomData = {
                id: 50, parent: 4, previous: 20 + tags.length - 1, tag: "svg:circle", attributes: { r: "5", fill: "green" }
            };
            const descendant: Layout.DomData = {
                id: 51, parent: 20, previous: null, tag: "svg:title"
            };
            if (eventType === 6) { layout.markup({ time: 0, event: 5, data: base }); }
            layout.markup({
                time: 1,
                event: eventType,
                data: [...(eventType === 5 ? base : []), ...animations, descendant, sibling]
            });
            return {
                placeholders: animations.map((node: Layout.DomData) => {
                    const element = layout.element(node.id) as Element;
                    return { type: element.nodeType, attributes: element.hasAttributes?.() ?? false };
                }),
                descendant: layout.element(51) === null,
                order: Array.from(layout.element(4).childNodes).map((node: Node): string => node.nodeName),
                href: (layout.element(4) as Element).getAttribute("href"),
                namespace: (layout.element(5) as Element).namespaceURI,
                fill: (layout.element(5) as Element).getAttribute("fill"),
                viewBox: (layout.element(3) as Element).getAttribute("viewBox")
            };
        }, { base: staticNodes, tags: animationTags, eventType: event });

        expect(result.placeholders).toEqual(animationTags.map(() => ({ type: 8, attributes: false })));
        expect(result.descendant).toBe(true);
        expect(result.order).toEqual(["rect", ...animationTags.map(() => "#comment"), "circle"]);
        expect(result.href).toBe("#first");
        expect(result.namespace).toBe("http://www.w3.org/2000/svg");
        expect(result.fill).toBe("navy");
        expect(result.viewBox).toBe("0 0 100 100");
    });
}

test("preserves SVG placeholders through updates, removal and reinsertion", async ({ page }): Promise<void> => {
    const result = await page.evaluate((base: Layout.DomData[]) => {
        const layout = window.svgReplay.layout;
        const animation: Layout.DomData = {
            id: 20, parent: 4, previous: 5, tag: "svg:animate",
            attributes: { attributeName: "fill", values: "navy;green", begin: "indefinite" }
        };
        layout.markup({ time: 0, event: 5, data: [...base, animation] });
        const initial = layout.element(20);
        layout.markup({
            time: 1, event: 6,
            data: [{ ...animation, attributes: { attributeName: "xlink:href", to: "#second", begin: "indefinite" } }]
        });
        const updated = layout.element(20);
        layout.markup({ time: 2, event: 6, data: [{ ...animation, parent: null, previous: null }] });
        const detached = layout.element(20).parentNode === null;
        layout.markup({
            time: 3, event: 6,
            data: [
                { id: 30, parent: 20, previous: null, tag: "svg:title" },
                { ...animation, previous: null },
                { id: 5, parent: 4, previous: 20, tag: "svg:rect", attributes: { fill: "green" } }
            ]
        });
        return {
            type: initial.nodeType,
            same: initial === updated && initial === layout.element(20),
            detached,
            descendant: layout.element(30) === null,
            order: Array.from(layout.element(4).childNodes).map((node: Node): string => node.nodeName),
            fill: (layout.element(5) as Element).getAttribute("fill"),
            href: (layout.element(4) as Element).getAttribute("href")
        };
    }, staticNodes);

    expect(result).toEqual({
        type: 8, same: true, detached: true, descendant: true,
        order: ["#comment", "rect"], fill: "green", href: "#first"
    });
});
