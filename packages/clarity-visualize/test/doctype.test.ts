import { expect, test, type Page } from "@playwright/test";
import { join } from "path";

type Attributes = { name: string; publicId: string; systemId: string };

async function renderDoctype(
    page: Page, attributes: Attributes, nested: boolean = false
): Promise<{ publicId: string; systemId: string; tags: string[]; mode: string }> {
    return page.evaluate(async ({ recorded, child }) => {
        const replay = (document.querySelector("#replay") as HTMLIFrameElement).contentWindow;
        const visualize = (window as any).clarity.visualize;
        visualize.setup(replay, {});
        await visualize.dom({
            time: 0, event: 5, data: [
                ...(child ? [
                    { id: 1, parent: null, previous: null, tag: "HTML", attributes: {} },
                    { id: 2, parent: 1, previous: null, tag: "BODY", attributes: {} },
                    { id: 3, parent: 2, previous: null, tag: "IFRAME", attributes: {} }
                ] : []),
                { id: 4, parent: child ? 3 : null, previous: null, tag: child ? "iframe:*D" : "*D", attributes: recorded }
            ]
        });
        const doc = child ? replay.document.querySelector("iframe").contentDocument : replay.document;
        return {
            publicId: doc.doctype.publicId, systemId: doc.doctype.systemId,
            tags: Array.from(doc.querySelectorAll("*")).map(element => element.tagName),
            mode: doc.compatMode
        };
    }, { recorded: attributes, child: nested });
}

test.beforeEach(async ({ page }) => {
    await page.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><iframe id="replay" sandbox="allow-same-origin"></iframe>');
    await page.addScriptTag({ path: join(__dirname, "..", "build", "clarity.visualize.min.js") });
});

for (const nested of [false, true]) {
    test(`normalizes identifiers in ${nested ? "nested" : "main"} documents`, async ({ page }) => {
        for (const field of ["publicId", "systemId"]) {
            const result = await renderDoctype(page, {
                name: "html", publicId: "", systemId: "", [field]: '"><div>marker</div>'
            }, nested);
            expect(result[field]).toBe("\uFFFD\uFFFD\uFFFDdiv\uFFFDmarker\uFFFD/div\uFFFD");
            expect(result.tags).toEqual(["HTML", "HEAD", "BODY"]);
        }
    });
}

test("preserves document rendering modes", async ({ page }) => {
    for (const quirks of [false, true]) {
        const result = await renderDoctype(page, {
            name: "html", publicId: quirks ? "-//W3C//DTD HTML 4.01 Transitional//EN" : "", systemId: ""
        });
        expect(result.mode).toBe(quirks ? "BackCompat" : "CSS1Compat");
    }
});

test("retains existing content when the document name is invalid", async ({ page }) => {
    const body = page.frameLocator("#replay").locator("body");
    await body.evaluate(element => element.textContent = "Existing replay");
    await expect(renderDoctype(page, { name: "invalid name", publicId: "", systemId: "" })).rejects.toThrow(/InvalidCharacterError/);
    await expect(body).toHaveText("Existing replay");
});
