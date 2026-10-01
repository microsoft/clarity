import { expect, Page, Route, test } from "@playwright/test";
import { join } from "path";
import { Config } from "../types/core";

const origin = "https://clarity.test/";
const upload = `${origin}collect`;
const mask = "\u2022";
const digit = "\u25ab";

type CaptureWindow = typeof window & {
    clarity: (command: "start" | "stop", config?: Config) => void;
};

async function collect(page: Page, sampled: boolean, beforeResponse?: (page: Page) => Promise<void>): Promise<string[]> {
    const payloads: string[] = [];
    const errors: string[] = [];
    const onError = (error: Error): number => errors.push(error.message);
    const handler = async (route: Route): Promise<void> => {
        payloads.push(route.request().postData());
        const first = payloads.length === 1;
        if (first && beforeResponse) { await beforeResponse(page); }
        await route.fulfill({
            status: first ? 200 : 204,
            contentType: "text/plain",
            body: first ? `${sampled ? "HEADINGS \n" : ""}ACTION headings-complete` : ""
        });
    };
    page.on("pageerror", onError);
    await page.route(upload, handler);
    await page.evaluate(() => {
        Object.defineProperty(window, "CompressionStream", { value: undefined, configurable: true });
        document.documentElement.removeAttribute("data-headings-response");
    });
    await page.addScriptTag({ path: join(__dirname, "../build/clarity.min.js") });
    await page.evaluate((endpoint: string): void => {
        (window as CaptureWindow).clarity("start", {
            projectId: "test", track: false, delay: 50, upload: endpoint,
            action: (value: string): void => document.documentElement.setAttribute("data-headings-response", value)
        });
    }, upload);
    await expect(page.locator("html")).toHaveAttribute("data-headings-response", "headings-complete");
    expect(extract([payloads[0]])).toEqual([]);
    await page.evaluate(() => (window as CaptureWindow).clarity("stop"));
    await expect.poll(() => payloads.some(payload => JSON.parse(payload).e[9] === 1)).toBe(true);
    await page.unroute(upload, handler);
    page.removeListener("pageerror", onError);
    expect(errors).toEqual([]);
    return extract(payloads);
}

function extract(payloads: string[]): string[] {
    const values: string[] = [];
    for (const payload of payloads) {
        const events = (JSON.parse(payload) as { a?: (number | string | string[])[][] }).a || [];
        for (const tokens of events) {
            if (tokens[1] !== 1) { continue; }
            for (let i = 2; i < tokens.length - 1; i += 2) {
                if (tokens[i] === 40) {
                    const entries = tokens[i + 1];
                    expect(Array.isArray(entries)).toBe(true);
                    if (Array.isArray(entries)) { values.push(...entries); }
                }
            }
        }
    }
    return values;
}

test.describe("page headings requested by collect", () => {
    test.beforeEach(async ({ page }) => {
        await page.route("**/*", async (route: Route): Promise<void> => {
            if (route.request().url() === origin) {
                await route.fulfill({ contentType: "text/html", body: "<!doctype html><html><head></head><body></body></html>" });
            } else {
                await route.abort();
            }
        });
        await page.goto(origin);
    });

    test("collects three normalized BFS headings with a surrogate-safe compact text cap", async ({ page }) => {
        await page.setContent("<h0>Invalid</h0><h7>Invalid</h7><h10>Invalid</h10><a1>Invalid</a1>" +
            "<div><h4>Nested first</h4></div><h1> Same\r\n\t123 </h1><h1>Same   123</h1>" +
            `<h6 data-clarity-unmask>${"a".repeat(29)}\ud83d\udca1</h6>`);
        expect(await collect(page, true)).toEqual([
            `H1:Same ${digit.repeat(3)}\nH1:Same ${digit.repeat(3)}\nH6:${"a".repeat(29)}`
        ]);
    });

    test("honors privacy and empty slots, waits for authorization, and resets on restart", async ({ page }) => {
        const text = "Order 123 H1: A=B\\n";
        await page.setContent("<h1> \t </h1><h2 data-clarity-mask><span data-clarity-unmask>Private</span></h2>" +
            `<h3 data-clarity-unmask>${text}</h3><h4>Not selected</h4>`);
        expect(await collect(page, false)).toEqual([]);
        expect(await collect(page, true, async current => {
            await current.evaluate(() => { document.querySelector("h3").textContent = "Changed after capture"; });
        })).toEqual([`H2:${mask.repeat(5)} ${mask.repeat(4)}\nH3:${text}`]);
        await page.setContent("<h1></h1><h2> </h2><h3>\t</h3><h4>Not selected</h4>");
        expect(await collect(page, true)).toEqual([]);
        await page.setContent("<h2>Restarted</h2>");
        expect(await collect(page, true)).toEqual(["H2:Restarted"]);
    });
});
