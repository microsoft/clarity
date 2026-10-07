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
        (command: "upgrade" | "event", key: string): void;
    };
    headingReads: number;
    headingTraversals: number;
    headingResume: () => void;
};

async function collect(
    page: Page, sampled: boolean, beforeResponse?: (page: Page) => Promise<void>,
    config: Partial<Config> = {}, afterStart?: (page: Page) => Promise<void>,
    afterResponse?: (page: Page, payloads: string[]) => Promise<void>, build: string = "clarity.min.js",
    reuseBundle: boolean = false
): Promise<string[]> {
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
    if (!reuseBundle) { await page.addScriptTag({ path: join(__dirname, "../build", build) }); }
    await page.evaluate((settings: { endpoint: string; config: Partial<Config> }): void => {
        (window as CaptureWindow).clarity("start", {
            projectId: "test", track: false, delay: 50, upload: settings.endpoint, ...settings.config,
            action: (value: string): void => document.documentElement.setAttribute("data-headings-response", value)
        });
    }, { endpoint: upload, config });
    if (afterStart) { await afterStart(page); }
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

async function pauseDiscovery(page: Page, afterRead: number = 0): Promise<void> {
    await page.evaluate((readCount: number): void => {
        const current = window as CaptureWindow;
        const firstChild = Object.getOwnPropertyDescriptor(Node.prototype, "firstChild");
        const textContent = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
        const now = performance.now.bind(performance);
        const pause = (): void => {
            Object.defineProperty(performance, "now", { configurable: true, value: () => now() + 1000 });
        };
        current.headingReads = 0;
        current.headingTraversals = 0;
        current.headingResume = undefined;
        Object.defineProperty(document, "firstChild", {
            configurable: true,
            get(): Node {
                if (++current.headingTraversals === 1 && readCount === 0) { pause(); }
                return firstChild.get.call(this);
            }
        });
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
        Object.defineProperty(HTMLHeadingElement.prototype, "textContent", {
            configurable: true,
            get(): string {
                const value = textContent.get.call(this);
                if (++current.headingReads === readCount) { pause(); }
                return value;
            },
            set: textContent.set
        });
    }, afterRead);
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
            `<h6 data-clarity-unmask>${"a".repeat(59)}\ud83d\udca1</h6>`);
        expect(await collect(page, true)).toEqual([
            `H1:Same ${digit.repeat(3)}\nH1:Same ${digit.repeat(3)}\nH6:${"a".repeat(59)}`
        ]);
        await page.setContent([1, 2, 3].map(level => `<h${level} data-clarity-unmask>${"a".repeat(61)}</h${level}>`).join(""));
        const maximum = [1, 2, 3].map(level => `H${level}:${"a".repeat(60)}`).join("\n");
        expect(maximum.length).toBe(191);
        expect(await collect(page, true)).toEqual([maximum]);
    });

    test("honors privacy and empty slots, waits for authorization, and resets on restart", async ({ page }) => {
        const text = "Order 123 H1: A=B\\n";
        await page.setContent("<h1> \t </h1><h2 data-clarity-mask><span data-clarity-unmask>Private</span></h2>" +
            `<h3 data-clarity-unmask>${text}</h3><h4>Not selected</h4>`);
        expect(await collect(page, false)).toEqual([]);
        expect(await collect(page, true, async current => {
            await current.evaluate(() => { document.querySelector("h3").textContent = "Changed after capture"; });
        })).toEqual([`H3:${text}`]);
        await page.setContent("<h1></h1><h2> </h2><h3>\t</h3><h4>Not selected</h4>");
        expect(await collect(page, true)).toEqual([]);
        await page.setContent("<h1 data-clarity-mask>Private</h1><h4>18+ | COMPETENT REGULATOR EEEP</h4><h5>Version 123</h5>");
        expect(await collect(page, true)).toEqual([`H4:${digit.repeat(2)}+ | COMPETENT REGULATOR EEEP\nH5:Version ${digit.repeat(3)}`]);
        await page.setContent(`<h1 data-clarity-unmask>${mask}\t\u00a0\ufeff${mask}</h1>` +
            "<h2 data-clarity-mask>Private</h2><h3 data-clarity-mask>Also private</h3><h4>Not selected</h4>");
        expect(await collect(page, true)).toEqual([]);
        await page.setContent("<div id='shadow'></div><iframe></iframe><h2>Restarted</h2>");
        await page.evaluate(() => {
            document.querySelector("#shadow").attachShadow({ mode: "open" }).innerHTML = "<h1>Shadow</h1>";
            document.querySelector("iframe").contentDocument.body.innerHTML = "<h1>Iframe</h1>";
        });
        expect(await collect(page, true)).toEqual(["H2:Restarted"]);
        expect(await collect(page, false)).toEqual([]);
    });

    test("fills remaining slots during queued lite-upgrade rediscovery", async ({ page }) => {
        await page.setContent("<h1 data-clarity-unmask>Original</h1><div>Tail</div>");
        await pauseDiscovery(page, 1);
        const values = await collect(page, true, undefined, { lite: true, lean: true }, async current => {
            await current.waitForFunction(() => (window as CaptureWindow).headingResume !== undefined);
            await current.evaluate(() => {
                (window as CaptureWindow).clarity("upgrade", "heading-test");
                (window as CaptureWindow).headingResume();
            });
        }, async current => {
            await current.waitForFunction(() => (window as CaptureWindow).headingReads === 2);
        });
        expect(await page.evaluate(() => (window as CaptureWindow).headingTraversals)).toBe(2);
        expect(await page.evaluate(() => (window as CaptureWindow).headingReads)).toBe(2);
        expect(values).toEqual(["H1:Original"]);
    });

    test("publishes one completed snapshot in an ordinary upload after early permission", async ({ page }) => {
        const texts = ["a", "b", "c"].map(text => text.repeat(61));
        await page.setContent(texts.map((text, index) =>
            `<h${index + 1} data-clarity-unmask>${text}</h${index + 1}>`).join("") + "<h4>Not selected</h4>");
        const records = texts.map((text, index) => `H${index + 1}:${text.substring(0, 60)}`);
        const complete = records.join("\n");
        await pauseDiscovery(page);
        const values = await collect(page, true, async current => {
            await current.waitForFunction(() => (window as CaptureWindow).headingResume !== undefined);
        }, { lean: true }, undefined, async (current, payloads) => {
            expect(await current.evaluate(() => (window as CaptureWindow).headingReads)).toBe(0);
            expect(extract(payloads)).toEqual([]);
            await current.evaluate(() => (window as CaptureWindow).headingResume());
            await current.evaluate(() => (window as CaptureWindow).clarity("event", "heading-next-upload"));
            await expect.poll(() => extract(payloads)).toEqual([complete]);
            expect(payloads.every(payload => JSON.parse(payload).e[9] === 0)).toBe(true);
        });
        expect(values).toEqual([complete]);
        expect(values[0].length).toBe(191);
    });

    test("publishes a completed snapshot in an ordinary upload after late permission", async ({ page }) => {
        await page.setContent("<h1 data-clarity-unmask>Ready</h1><h2 data-clarity-unmask>Before permission</h2>");
        const complete = "H1:Ready\nH2:Before permission";
        const values = await collect(page, true, async current => {
            await current.evaluate(() => {
                document.querySelector("h1").textContent = "Not recaptured";
            });
        }, {}, undefined, async (_current, payloads) => {
            await expect.poll(() => extract(payloads)).toEqual([complete]);
            expect(payloads.every(payload => JSON.parse(payload).e[9] === 0)).toBe(true);
        });
        expect(values).toEqual([complete]);
    });

    test("permission during traversal waits for the completed buffer", async ({ page }) => {
        await page.setContent("<h1 data-clarity-unmask>First</h1><h2 data-clarity-unmask>Second</h2>");
        await pauseDiscovery(page, 1);
        const values = await collect(page, true, async current => {
            await current.waitForFunction(() => (window as CaptureWindow).headingResume !== undefined);
        }, { lean: true }, undefined, async (current, payloads) => {
            expect(await current.evaluate(() => (window as CaptureWindow).headingReads)).toBe(1);
            const before = payloads.length;
            await current.evaluate(() => (window as CaptureWindow).clarity("event", "heading-pending-upload"));
            await expect.poll(() => payloads.length).toBeGreaterThan(before);
            expect(extract(payloads)).toEqual([]);
            await current.evaluate(() => (window as CaptureWindow).headingResume());
            await current.evaluate(() => (window as CaptureWindow).clarity("event", "heading-next-upload"));
            await expect.poll(() => extract(payloads)).toEqual(["H1:First\nH2:Second"]);
        });
        expect(values).toEqual(["H1:First\nH2:Second"]);
    });

    for (const count of [1, 3]) {
        test(`does not publish ${count} buffered headings when stopped during traversal`, async ({ page }) => {
            await page.setContent("<h1 data-clarity-unmask>First</h1><h2 data-clarity-unmask>Second</h2>" +
                "<h3 data-clarity-unmask>Third</h3><div>Pending traversal</div>");
            await pauseDiscovery(page, count);
            const values = await collect(page, true, async current => {
                await current.waitForFunction(() => (window as CaptureWindow).headingResume !== undefined);
            }, { lean: true }, undefined, async (current, payloads) => {
                expect(await current.evaluate(() => (window as CaptureWindow).headingReads)).toBe(count);
                expect(extract(payloads)).toEqual([]);
            });
            expect(values).toEqual([]);
            await page.evaluate(() => (window as CaptureWindow).headingResume());
            await page.setContent("<h1 data-clarity-unmask>Restarted</h1>");
            expect(await collect(page, true, undefined, {}, undefined, undefined, "clarity.min.js", true)).toEqual(["H1:Restarted"]);
        });
    }

    test("an interrupted traversal cannot complete a restarted run", async ({ page }) => {
        await page.setContent("<h1 data-clarity-unmask>Old run</h1>");
        await pauseDiscovery(page);
        expect(await collect(page, true, undefined, { lean: true })).toEqual([]);
        const staleResume = await page.evaluateHandle(() => (window as CaptureWindow).headingResume);
        await pauseDiscovery(page, 1);
        await page.setContent("<h1 data-clarity-unmask>New run</h1><h2 data-clarity-unmask>Later</h2>");
        const values = await collect(page, true, undefined, { lean: true }, undefined, async (current, payloads) => {
            expect(await current.evaluate(() => (window as CaptureWindow).headingReads)).toBe(1);
            const before = payloads.length;
            await current.evaluate(resume => resume(), staleResume);
            await current.evaluate(() => (window as CaptureWindow).clarity("event", "heading-stale-upload"));
            await expect.poll(() => payloads.length).toBeGreaterThan(before);
            expect(extract(payloads)).toEqual([]);
            await current.evaluate(() => (window as CaptureWindow).headingResume());
            await current.evaluate(() => (window as CaptureWindow).clarity("event", "heading-next-upload"));
            await expect.poll(() => extract(payloads)).toEqual(["H1:New run\nH2:Later"]);
        }, "clarity.min.js", true);
        await staleResume.dispose();
        expect(values).toEqual(["H1:New run\nH2:Later"]);
    });

    test("publishes remaining slots only after lite-upgrade rediscovery completes", async ({ page }) => {
        await page.setContent("<h1 data-clarity-unmask>Original</h1>");
        await pauseDiscovery(page, 2);
        // The initial lite pass consumes a masked slot; upgraded discovery fills the other two.
        const complete = "H1:Original\nH2:Later";
        const values = await collect(page, true, undefined, { lite: true, lean: true }, undefined, async (current, payloads) => {
            expect(await current.evaluate(() => (window as CaptureWindow).headingReads)).toBe(1);
            const initial = payloads.length;
            await current.evaluate(() => (window as CaptureWindow).clarity("event", "heading-initial-upload"));
            await expect.poll(() => payloads.length).toBeGreaterThan(initial);
            expect(extract(payloads)).toEqual([]);
            await current.evaluate(() => {
                const heading = document.createElement("h2");
                heading.setAttribute("data-clarity-unmask", "");
                heading.textContent = "Later";
                document.body.appendChild(heading);
                (window as CaptureWindow).clarity("upgrade", "heading-test");
            });
            await current.waitForFunction(() => (window as CaptureWindow).headingResume !== undefined);
            expect(await current.evaluate(() => (window as CaptureWindow).headingReads)).toBe(2);
            const before = payloads.length;
            await current.evaluate(() => (window as CaptureWindow).clarity("event", "heading-pending-upload"));
            await expect.poll(() => payloads.length).toBeGreaterThan(before);
            expect(extract(payloads)).toEqual([]);
            await current.evaluate(() => (window as CaptureWindow).headingResume());
            await current.evaluate(() => (window as CaptureWindow).clarity("event", "heading-next-upload"));
            await expect.poll(() => extract(payloads)).toEqual([complete]);
        });
        expect(values).toEqual([complete]);
    });

    for (const build of ["clarity.min.js", "clarity.extended.js", "clarity.insight.js", "clarity.performance.js"]) {
        test(`${build} retains its heading behavior in lean mode`, async ({ page }) => {
            await page.setContent("<h1 data-clarity-unmask>Lean heading</h1>");
            const values = await collect(page, true, undefined, { lean: true }, undefined, undefined, build);
            expect(values).toEqual(build === "clarity.min.js" || build === "clarity.extended.js" ? ["H1:Lean heading"] : []);
        });
    }
});
