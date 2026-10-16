import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { decode } from "clarity-decode";
import type { Core, Layout } from "clarity-decode";
import type { Visualizer } from "clarity-visualize";
import { join } from "path";
import version from "../packages/clarity-js/src/core/version";
import { node } from "./helper";

const cases = [
    ["onerror", "onload", "onfocus"],
    ["ONERROR", "ONLOAD", "ONFOCUS"],
    ["OnError", "OnLoad", "OnFocus"]
];
const origin = "http://localhost/";
const html = "<!doctype html><html><head></head><body></body></html>";
const attributeValue = "/* ignored attribute */";

async function localPage(page: Page): Promise<void> {
    await page.route("**/*", async (route: Route): Promise<void> => {
        if (route.request().url() === origin) {
            await route.fulfill({ status: 200, contentType: "text/html", body: html });
        } else {
            await route.abort();
        }
    });
    await page.goto(origin);
}

for (const names of cases) {
    test(`capture excludes ${names.join(", ")} without changing SVG attribute names`, async ({ page }) => {
        await localPage(page);
        const sourceNames = await page.evaluate(({ attributes, value }: { attributes: string[]; value: string }) => {
            const element = document.createElement("div");
            element.id = "capture-attributes";
            for (const name of attributes) {
                element.setAttributeNS(null, name, value);
            }
            document.body.appendChild(element);
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.id = "capture-svg";
            svg.setAttribute("viewBox", "0 0 10 10");
            document.body.appendChild(svg);
            return element.getAttributeNames();
        }, { attributes: names, value: attributeValue });
        expect(sourceNames).toEqual(["id", ...names]);
        await page.addScriptTag({ path: join(__dirname, "../packages/clarity-js/build/clarity.min.js") });
        await page.evaluate(() => {
            window.payloads = [];
            const config: Core.Config = {
                projectId: "attribute-test",
                track: false,
                lean: false,
                delay: 100,
                upload: (payload: string): void => { window.payloads.push(payload); }
            };
            window.clarity("start", config);
        });

        await expect.poll(async () => {
            const pendingPayloads = await page.evaluate(() => window.payloads);
            return node(pendingPayloads.map(payload => decode(payload)), "attributes", "capture-svg", "id");
        }).not.toBeNull();
        await page.evaluate(() => window.clarity("stop"));
        const payloads = await page.evaluate(() => window.payloads);
        const decoded = payloads.map(payload => decode(payload));
        const captured = node(decoded, "attributes", "capture-attributes", "id");
        expect(captured).not.toBeNull();
        expect(captured.attributes).toEqual({ id: "capture-attributes" });
        expect(node(decoded, "attributes", "capture-svg", "id").attributes.viewBox).toBe("0 0 10 10");
    });

    test(`replay clears ${names.join(", ")} during discovery and updates`, async ({ page }) => {
        await localPage(page);
        await page.addScriptTag({ path: join(__dirname, "../packages/clarity-visualize/build/clarity.visualize.min.js") });
        const result = await page.evaluate(async ({ attributes, value, buildVersion }) => {
            const api: Visualizer = Reflect.get(Reflect.get(window, "clarity"), "visualize");
            const iframe = document.createElement("iframe");
            iframe.setAttribute("sandbox", "allow-same-origin");
            document.body.appendChild(iframe);
            const target = iframe.contentWindow;
            if (!target) { throw new Error("Replay window was not created."); }
            await api.setup(target, { version: buildVersion, pointer: false, canvas: false });
            const recorded: Layout.DomData = {
                id: 4, parent: 3, previous: null, tag: "DIV",
                attributes: { id: "replay-attributes", "data-label": "preserved" }
            };
            for (const name of attributes) {
                recorded.attributes[name] = value;
            }
            const initial: Layout.DomEvent = {
                time: 0, event: 5,
                data: [
                    { id: 1, parent: null, previous: null, tag: "HTML" },
                    { id: 2, parent: 1, previous: null, tag: "HEAD" },
                    { id: 3, parent: 1, previous: 2, tag: "BODY" },
                    recorded,
                    {
                        id: 5, parent: 3, previous: 4, tag: "svg:svg",
                        attributes: { id: "replay-svg", viewBox: "0 0 10 10" }
                    }
                ]
            };
            await api.dom(initial);
            const element = target.document.getElementById("replay-attributes");
            if (!element) { throw new Error("Recorded element was not rendered."); }
            const discovery = attributes.map((name: string) => element.getAttribute(name));
            recorded.attributes["data-label"] = "updated";
            await api.dom({ time: 1, event: 6, data: [recorded] });
            return {
                discovery,
                mutation: attributes.map((name: string) => element.getAttribute(name)),
                label: element.getAttribute("data-label"),
                viewBox: target.document.getElementById("replay-svg").getAttribute("viewBox")
            };
        }, { attributes: names, value: attributeValue, buildVersion: version });
        expect(result.discovery).toEqual(["", "", ""]);
        expect(result.mutation).toEqual(["", "", ""]);
        expect(result.label).toBe("updated");
        expect(result.viewBox).toBe("0 0 10 10");
    });
}
