import { expect, Page, Route, test } from "@playwright/test";
import { join } from "path";
import { Config } from "../types/core";

const origin = "https://clarity.test/";
const upload = `${origin}collect`;
const mask = "\u2022";
const digit = "\u25ab";
const maskedToken = mask.repeat(5) + " " + mask.repeat(4);

type CaptureWindow = typeof window & {
    clarity: {
        (command: "start" | "stop", config?: Config): void;
        (command: "upgrade" | "event", key: string): void;
    };
    headingTextReads: number;
    resumeHeadingDiscovery: () => void;
};

async function collect(
    page: Page, sampled: boolean, config: Config = {}, afterCapture?: (page: Page) => Promise<void>,
    beforeResponse?: (page: Page) => Promise<void>, build: string = "clarity.min.js"
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
    await page.addScriptTag({ path: join(__dirname, "../build", build) });
    await page.evaluate(({ options, endpoint }: { options: Config; endpoint: string }): void => {
        (window as CaptureWindow).clarity("start", {
            projectId: "test", track: false, delay: 50, ...options, upload: endpoint,
            action: (value: string): void => document.documentElement.setAttribute("data-headings-response", value)
        });
    }, { options: config, endpoint: upload });

    await expect(page.locator("html")).toHaveAttribute("data-headings-response", "headings-complete");
    expect(extract([payloads[0]])).toEqual([]);
    if (afterCapture) { await afterCapture(page); }
    await page.evaluate(() => (window as CaptureWindow).clarity("stop"));
    await expect.poll(() => payloads.some(payload => JSON.parse(payload).e[9] === 1)).toBe(true);
    if (config.lean && !afterCapture && !beforeResponse) {
        expect(payloads.every(payload => (JSON.parse(payload).p || []).length === 0)).toBe(true);
    }
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

    test("selects only the first three BFS headings and preserves normalized tags and duplicates", async ({ page }) => {
        await page.setContent("<h0>Invalid</h0><h7>Invalid</h7><h10>Invalid</h10><a1>Invalid</a1>" +
            "<div><h4>Nested first</h4></div><h1> Same\r\n\t123 </h1><h1>Same   123</h1>" +
            `<h6>  ${"long".repeat(20)} </h6>`);
        expect(await collect(page, true)).toEqual([
            `H1:Same ${digit.repeat(3)}\nH1:Same ${digit.repeat(3)}\nH6:${"long".repeat(20).substring(0, 30)}`
        ]);
    });

    test("honors target masking and unmasking without backfilling empty selection slots", async ({ page }) => {
        await page.setContent("<h1> \t </h1><h2 data-clarity-mask><span data-clarity-unmask>Private</span></h2>" +
            "<h3 data-clarity-unmask>Order 123</h3><h4>Not selected</h4>");
        expect(await collect(page, true)).toEqual([`H2:${maskedToken}\nH3:Order 123`]);
        await page.setContent("<h1></h1><h2> </h2><h3>\t</h3><h4>Not selected</h4>");
        expect(await collect(page, true)).toEqual([]);
    });

    test("preserves compact record boundaries and bounds values to 101 UTF-16 units", async ({ page }) => {
        await page.setContent("<h1 data-clarity-unmask></h1><h2 data-clarity-unmask></h2><h3 data-clarity-unmask></h3>");
        const text = "\u0001".repeat(28) + "\ud83d\udca1";
        await page.evaluate((value: string) => {
            document.querySelectorAll("h1,h2,h3").forEach(heading => { heading.textContent = value; });
        }, text);
        const values = await collect(page, true);
        expect(values).toEqual([`H1:${text}\nH2:${text}\nH3:${text}`]);
        expect(values[0].length).toBe(101);
        await page.setContent("<h2 data-clarity-unmask></h2>");
        const punctuation = "H1: A=B:C|D~E\\n \"x\"";
        await page.evaluate((value: string) => { document.querySelector("h2").textContent = value; }, punctuation);
        expect(await collect(page, true)).toEqual([`H2:${punctuation}`]);
        await page.evaluate((value: string) => { document.querySelector("h2").textContent = value; }, "a".repeat(29) + "\ud83d\udca1");
        expect(await collect(page, true)).toEqual([`H2:${"a".repeat(29)}`]);
        await page.setContent(`<h1 data-clarity-mask>${"A".repeat(30)}</h1>`);
        const masked = mask.repeat(5) + (" " + mask.repeat(4)).repeat(5);
        expect(masked.length).toBe(30);
        expect(await collect(page, true)).toEqual([`H1:${masked}`]);
    });

    test("buffers three headings during discovery without uploading unsampled values or rescanning on request", async ({ page }) => {
        await page.setContent("<h1>Heading</h1>".repeat(4));
        await page.evaluate(() => {
            const capture = window as CaptureWindow;
            const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
            capture.headingTextReads = 0;
            Object.defineProperty(HTMLHeadingElement.prototype, "textContent", {
                configurable: true,
                get(this: HTMLHeadingElement): string { capture.headingTextReads++; return descriptor.get.call(this); },
                set: descriptor.set
            });
        });
        expect(await collect(page, false)).toEqual([]);
        expect(await page.evaluate(() => (window as CaptureWindow).headingTextReads)).toBe(3);
        expect(await collect(page, true, {}, undefined, async current => {
            expect(await current.evaluate(() => (window as CaptureWindow).headingTextReads)).toBe(6);
            await current.evaluate(() => { document.querySelector("h1").textContent = "Changed"; });
        })).toEqual(["H1:Heading\nH1:Heading\nH1:Heading"]);
        expect(await page.evaluate(() => (window as CaptureWindow).headingTextReads)).toBe(6);
    });

    test("waits for complete discovery when HEADINGS arrives during suspension", async ({ page }) => {
        const entries = [{ tag: "H1", text: "First" }, { tag: "H2", text: "Second" }, { tag: "H3", text: "Third" }];
        await page.setContent(entries.map(entry => `<${entry.tag}>${entry.text}</${entry.tag}>`).join(""));
        await page.evaluate(() => {
            const capture = window as CaptureWindow;
            const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
            const now = performance.now.bind(performance);
            let resume: () => void;
            capture.headingTextReads = 0;
            Object.defineProperty(window, "requestIdleCallback", {
                configurable: true,
                value: (callback: (deadline: { timeRemaining: () => number }) => void): void => {
                    resume = () => callback({ timeRemaining: () => 1000 });
                }
            });
            Object.defineProperty(HTMLHeadingElement.prototype, "textContent", {
                configurable: true,
                get(this: HTMLHeadingElement): string {
                    capture.headingTextReads++;
                    if (capture.headingTextReads === 1) {
                        Object.defineProperty(performance, "now", { configurable: true, value: () => now() + 1000 });
                    }
                    return descriptor.get.call(this);
                },
                set: descriptor.set
            });
            capture.resumeHeadingDiscovery = (): void => {
                Object.defineProperty(performance, "now", { configurable: true, value: now });
                if (!resume) { throw new Error("Discovery did not suspend"); }
                resume();
            };
        });

        expect(await collect(page, true, {}, async current => {
            expect(await current.evaluate(() => (window as CaptureWindow).headingTextReads)).toBe(1);
            const pending = current.waitForResponse(response => response.url() === upload);
            await current.evaluate(() => (window as CaptureWindow).clarity("event", "before-discovery-finishes"));
            expect(extract([(await pending).request().postData()])).toEqual([]);
            await current.evaluate(() => (window as CaptureWindow).resumeHeadingDiscovery());
            await expect.poll(() => current.evaluate(() => (window as CaptureWindow).headingTextReads)).toBe(3);
            await current.waitForTimeout(50);
        })).toEqual(["H1:First\nH2:Second\nH3:Third"]);
    });

    test("keeps an empty main-document selection closed on upgrade and resets it on a new start", async ({ page }) => {
        await page.setContent("<div id='host'></div><iframe srcdoc='<h1>Iframe</h1>'></iframe>");
        await page.evaluate(() => {
            document.getElementById("host").attachShadow({ mode: "open" }).innerHTML = "<h1>Shadow</h1>";
        });
        expect(await collect(page, true, { lean: true, lite: true }, undefined, async current => {
            await current.evaluate(() => {
                document.body.insertAdjacentHTML("beforeend", "<h1>Too late</h1>");
                (window as CaptureWindow).clarity("upgrade", "before-headings-response");
            });
            await current.waitForTimeout(100);
        })).toEqual([]);
        await page.setContent("<h2>Restarted</h2>");
        expect(await collect(page, true)).toEqual(["H2:Restarted"]);
    });

    test("does not let cancelled discovery close the restarted buffer", async ({ page }) => {
        const payloads: string[] = [];
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.setContent("<h1>Cancelled</h1>");
        await page.evaluate(() => {
            const now = performance.now.bind(performance);
            Object.defineProperty(window, "requestIdleCallback", {
                configurable: true,
                value: (callback: (deadline: { timeRemaining: () => number }) => void): void => {
                    window.setTimeout(() => {
                        Object.defineProperty(performance, "now", { configurable: true, value: now });
                        callback({ timeRemaining: () => 1000 });
                    }, 50);
                }
            });
        });
        await page.route(upload, async route => {
            const payload = route.request().postData();
            payloads.push(payload);
            const envelope = JSON.parse(payload).e;
            const first = envelope[1] === 1 && envelope[9] === 0;
            await route.fulfill({
                status: first ? 200 : 204, contentType: "text/plain",
                body: first ? "HEADINGS\nACTION restarted" : ""
            });
        });
        await page.addScriptTag({ path: join(__dirname, "../build/clarity.min.js") });
        await page.evaluate((endpoint: string) => {
            Object.defineProperty(window, "CompressionStream", { value: undefined, configurable: true });
            const capture = window as CaptureWindow;
            const options: Config = {
                projectId: "test", track: false, delay: 50, upload: endpoint,
                action: (): void => document.documentElement.setAttribute("data-restarted", "true")
            };
            capture.clarity("start", options);
            capture.clarity("stop");
            document.body.innerHTML = "<h2>Restarted</h2><h3>Second</h3><h4>Third</h4>";
            const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
            const now = performance.now.bind(performance);
            capture.headingTextReads = 0;
            Object.defineProperty(HTMLHeadingElement.prototype, "textContent", {
                configurable: true,
                get(this: HTMLHeadingElement): string {
                    if (++capture.headingTextReads === 1) {
                        Object.defineProperty(performance, "now", { configurable: true, value: () => now() + 1000 });
                    }
                    return descriptor.get.call(this);
                },
                set: descriptor.set
            });
            capture.clarity("start", options);
        }, upload);
        await expect(page.locator("html")).toHaveAttribute("data-restarted", "true");
        await page.evaluate(() => (window as CaptureWindow).clarity("stop"));
        await expect.poll(() => extract(payloads)).toEqual(["H2:Restarted\nH3:Second\nH4:Third"]);
        expect(errors).toEqual([]);
    });

    for (const build of [
        { file: "clarity.min.js", enabled: true },
        { file: "clarity.extended.js", enabled: true },
        { file: "clarity.insight.js", enabled: false },
        { file: "clarity.performance.js", enabled: false }
    ]) {
        test(`${build.file} handles HEADINGS in lean/lite mode with missing privacy records`, async ({ page }) => {
            await page.setContent("<h1 data-clarity-unmask>Checkout</h1>");
            const values = await collect(page, true, { lean: true, lite: true }, undefined, undefined, build.file);
            expect(values).toEqual(build.enabled ? [`H1:${maskedToken}`] : []);
        });
    }
});
