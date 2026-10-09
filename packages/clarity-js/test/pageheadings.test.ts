import { expect, Page, Route, test } from "@playwright/test";
import { join } from "path";
import { Config } from "../types/core";

const origin = "https://clarity.test/";
const upload = `${origin}collect`;
const mask = "\u2022";
const digit = "\u25ab";

type CaptureWindow = typeof window & {
    clarity: {
        (command: "start" | "stop", config?: Config): void;
        (command: "event", key: string): void;
    };
    headingResume: () => void;
};

async function collect(
    page: Page, sampled: boolean, config: Partial<Config> = {},
    afterResponse?: (page: Page, payloads: string[]) => Promise<void>
): Promise<string[]> {
    const payloads: string[] = [];
    const errors: string[] = [];
    const onError = (error: Error): number => errors.push(error.message);
    const handler = async (route: Route): Promise<void> => {
        payloads.push(route.request().postData());
        const first = payloads.length === 1;
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
    await page.addScriptTag({ path: join(__dirname, "..", "build", "clarity.min.js") });
    await page.evaluate((settings: { endpoint: string; config: Partial<Config> }): void => {
        (window as CaptureWindow).clarity("start", {
            projectId: "test", track: false, delay: 50, upload: settings.endpoint, ...settings.config,
            action: (value: string): void => document.documentElement.setAttribute("data-headings-response", value)
        });
    }, { endpoint: upload, config });
    await expect(page.locator("html")).toHaveAttribute("data-headings-response", "headings-complete");
    expect(extract([payloads[0]])).toEqual([]);
    if (afterResponse) { await afterResponse(page, payloads); }
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

async function pauseDiscovery(page: Page): Promise<void> {
    await page.evaluate((): void => {
        const current = window as CaptureWindow;
        const attributes = Object.getOwnPropertyDescriptor(Element.prototype, "attributes");
        const now = performance.now.bind(performance);
        let paused = false;
        current.headingResume = undefined;
        Object.defineProperty(window, "requestIdleCallback", {
            configurable: true,
            value: (callback: (deadline: { timeRemaining: () => number }) => void): number => {
                current.headingResume = () => {
                    Object.defineProperty(performance, "now", { configurable: true, value: now });
                    callback({ timeRemaining: () => 1000 });
                };
                return 1;
            }
        });
        Object.defineProperty(HTMLHeadingElement.prototype, "attributes", {
            configurable: true,
            get(): NamedNodeMap {
                const value = attributes.get.call(this);
                if (!paused) {
                    paused = true;
                    Object.defineProperty(performance, "now", { configurable: true, value: () => now() + 1000 });
                }
                return value;
            }
        });
    });
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
            `<div><h4>Nested first</h4></div><h1 data-clarity-unmask>${"a".repeat(59)}` +
            "<span> \t </span><b>Later</b></h1><h1> Same\r\n\t123 </h1>" +
            `<h6 data-clarity-unmask>${"a".repeat(59)}\ud83d\udca1</h6>`);
        expect(await collect(page, true)).toEqual([
            `H1:${"a".repeat(59)}\nH1:Same ${digit.repeat(3)}\nH6:${"a".repeat(59)}`
        ]);
        await page.setContent([1, 2, 3].map(level => `<h${level} data-clarity-unmask>${"a".repeat(61)}</h${level}>`).join(""));
        const maximum = [1, 2, 3].map(level => `H${level}:${"a".repeat(60)}`).join("\n");
        expect(maximum.length).toBe(191);
        expect(await collect(page, true)).toEqual([maximum]);
    });

    test("keeps ten candidates and sends only the first three readable headings", async ({ page }) => {
        await page.setContent("<h1> </h1><h2 data-clarity-mask>Private</h2>" +
            "<h3>Third</h3><h4>Fourth</h4><h5>Fifth</h5><h6>Sixth</h6>");
        expect(await collect(page, true)).toEqual(["H3:Third\nH4:Fourth\nH5:Fifth"]);

        await page.setContent("<h1> </h1>".repeat(8) +
            "<h2>Ninth</h2><h3>Tenth</h3><h4>Outside budget</h4>");
        expect(await collect(page, true)).toEqual(["H2:Ninth\nH3:Tenth"]);
    });

    test("reuses cached text in DOM order, honors per-node privacy, and requires authorization", async ({ page }) => {
        await page.setContent("<h1 data-clarity-unmask> Welcome <span data-clarity-mask>PRIVATE_MARKER</span>" +
            " <em> to <strong>Clarity</strong></em> today </h1>" +
            "<h2 data-clarity-unmask>one<span>two</span>three</h2>" +
            "<h3 data-clarity-unmask>A <span class='private'>SECRET</span> B</h3>");
        await page.evaluate(() => {
            Object.defineProperty(HTMLHeadingElement.prototype, "textContent", {
                configurable: true,
                get(): string { throw new Error("Headings must reuse discovery text"); }
            });
        });
        expect(await collect(page, true, { mask: [".private"] })).toEqual([
            `H1:Welcome ${mask.repeat(14)} to Clarity today\nH2:onetwothree\nH3:A ${mask.repeat(6)} B`
        ]);

        await page.setContent("<h1 data-clarity-mask>Hidden <span data-clarity-unmask>Public 123</span> tail</h1>" +
            "<h2>Order <span data-clarity-unmask>123</span> reference 456</h2>" +
            "<h3 class='private'>Hidden <span class='public'>Configured public 123</span></h3>");
        const privacy = { mask: [".private"], unmask: [".public"] };
        expect(await collect(page, false, privacy)).toEqual([]);
        expect(await collect(page, true, privacy)).toEqual([
            `H1:${mask.repeat(6)} Public 123 ${mask.repeat(4)}\nH2:Order 123 reference ${digit.repeat(3)}` +
            `\nH3:${mask.repeat(6)} Configured public 123`
        ]);
    });

    test("publishes only completed discovery, never a canceled partial buffer", async ({ page }) => {
        for (const complete of [false, true]) {
            await page.goto(origin);
            await page.setContent("<h1 data-clarity-unmask>First</h1><h2 data-clarity-unmask>Second</h2>");
            await pauseDiscovery(page);
            const values = await collect(page, true, { lean: true }, async (current, payloads) => {
                await current.waitForFunction(() => (window as CaptureWindow).headingResume !== undefined);
                expect(extract(payloads)).toEqual([]);
                if (complete) {
                    await current.evaluate(() => (window as CaptureWindow).headingResume());
                    await current.evaluate(() => (window as CaptureWindow).clarity("event", "heading-next-upload"));
                    await expect.poll(() => extract(payloads)).toEqual(["H1:First\nH2:Second"]);
                    expect(payloads.every(payload => JSON.parse(payload).e[9] === 0)).toBe(true);
                }
            });
            expect(values).toEqual(complete ? ["H1:First\nH2:Second"] : []);
        }
    });
});
