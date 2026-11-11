import { expect, test } from "@playwright/test";
import type { Layout } from "clarity-decode";
import { resolve } from "path";

test.beforeEach(async ({ page }) => {
    await page.addScriptTag({ path: resolve(__dirname, "../build/clarity.visualize.min.js") });
});

for (const event of [5, 6]) {
    test(`blocks script preload requests during ${event === 5 ? "discovery" : "mutations"}`, async ({ page }) => {
        const requests: string[] = [];
        await page.route("https://resources.invalid/**", async (route) => {
            requests.push(route.request().url());
            await route.fulfill({ contentType: "application/javascript", body: "" });
        });
        const result = await page.evaluate(async (eventType: number) => {
            const api = (window as Window & { clarity: { visualize: typeof import("@src/clarity") } }).clarity.visualize;
            const proxied: string[] = [];
            const visualizer = await api.setup(window, {
                version: "0.8.76",
                corsProxyStylesheets: true,
                useproxy: (url: string): string => { proxied.push(url); return url; }
            });
            const layout = visualizer.layout;
            layout.nodes[1] = document.head;
            const attributes = [
                { rel: "modulepreload" },
                { rel: "preload", as: "script" },
                { rel: " \tMoDuLePrElOaD\n", as: "style" },
                { rel: "alternate\tPRELOAD\n", as: "ScRiPt" },
                { rel: "stylesheet modulepreload", as: "font" }
            ];
            const nodes: Layout.DomData[] = attributes.map((attrs, index: number): Layout.DomData => ({
                id: index + 2, parent: 1, previous: index === 0 ? null : index + 1, tag: "LINK",
                attributes: { href: `https://resources.invalid/${index}.js`, ...attrs }
            }));
            layout.markup({ time: 0, event: eventType, data: nodes });
            return {
                hrefs: nodes.map((node) => (layout.element(node.id) as Element).getAttribute("href")),
                recordedHrefs: nodes.map((node) => node.attributes.href),
                order: nodes.map((node) => layout.element(node.id).previousSibling ===
                    (node.previous === null ? null : layout.element(node.previous))),
                proxied,
                pending: layout.stylesheets.length + layout.fonts.length
            };
        }, event);
        await page.waitForTimeout(100);

        expect(requests).toEqual([]);
        expect(result.hrefs).toEqual([null, null, null, null, null]);
        expect(result.recordedHrefs).toEqual(Array.from({ length: 5 }, (_, index) => `https://resources.invalid/${index}.js`));
        expect(result.order).toEqual([true, true, true, true, true]);
        expect(result.proxied).toEqual([]);
        expect(result.pending).toBe(0);
    });
}

test("keeps script preload updates inert and restores non-script resource links", async ({ page }) => {
    const requests: string[] = [];
    await page.route("https://resources.invalid/**", async (route) => {
        requests.push(route.request().url());
        await route.fulfill({ contentType: "text/css", body: "" });
    });
    const result = await page.evaluate(async () => {
        const api = (window as Window & { clarity: { visualize: typeof import("@src/clarity") } }).clarity.visualize;
        const visualizer = await api.setup(window, { version: "0.8.76" });
        const layout = visualizer.layout;
        layout.nodes[1] = document.head;
        const node: Layout.DomData = { id: 2, parent: 1, previous: null, tag: "LINK" };
        const hrefs: string[] = [];
        for (const attributes of [
            { rel: "preload", as: "image", href: "https://resources.invalid/image.png" },
            { href: "https://resources.invalid/first.js", rel: "preload", as: "script" },
            { href: "https://resources.invalid/second.js", rel: "modulepreload" },
            { href: "https://resources.invalid/site.css", rel: "stylesheet" }
        ]) {
            layout.markup({ time: 1, event: 6, data: [{ ...node, attributes }] });
            hrefs.push((layout.element(2) as Element).getAttribute("href"));
        }
        await Promise.all(layout.stylesheets);
        for (const [index, as] of ["style", "font", "image"].entries()) {
            layout.markup({ time: 2, event: 6, data: [{
                id: index + 3, parent: 1, previous: index + 2, tag: "LINK",
                attributes: { rel: "preload", as, href: `https://resources.invalid/${as}` }
            }] });
        }
        return {
            hrefs,
            preloads: [3, 4, 5].map((id: number) => (layout.element(id) as Element).getAttribute("href"))
        };
    });
    await page.waitForTimeout(100);

    expect(requests.filter((url: string) => url.endsWith(".js"))).toEqual([]);
    expect(requests).toContain("https://resources.invalid/site.css");
    expect(result.hrefs).toEqual([
        "https://resources.invalid/image.png", null, null, "https://resources.invalid/site.css"
    ]);
    expect(result.preloads).toEqual([
        "https://resources.invalid/style", "https://resources.invalid/font", "https://resources.invalid/image"
    ]);
});
