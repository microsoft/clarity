import { expect, Page, Route, test } from "@playwright/test";
import { join } from "path";
import { Config } from "../types/core";

const origin = "https://clarity.test/";
const upload = `${origin}collect`;
const mask = "\u2022";
const digit = "\u25ab";
const letter = "\u25aa";
const maskedToken = mask.repeat(5) + " " + mask.repeat(4);
const email = letter.repeat(5) + "@" + letter.repeat(7) + "." + letter.repeat(3);

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
                if (tokens[i] === 41) {
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

    const cases = [
        { name: "preserves ordinary text", input: "Checkout", expected: "Checkout" },
        { name: "omits empty text", input: "", expected: "" },
        { name: "omits whitespace-only text", input: " \t\r\n\u00a0 ", expected: "" },
        { name: "normalizes whitespace", input: " \tAlpha\u00a0  Beta\r\nGamma ", expected: "Alpha Beta Gamma" },
        { name: "truncates normalized text", input: " \t" + "long".repeat(20), expected: "long".repeat(20).substring(0, 30) },
        { name: "keeps scrubbed text", input: "Order 123 alice@example.com", expected: `Order ${digit.repeat(3)} ${email}` }
    ];
    for (const entry of cases) {
        test(entry.name, async ({ page }) => {
            await page.setContent("<h1></h1>");
            await page.evaluate((value: string) => { document.querySelector("h1").textContent = value; }, entry.input);
            expect(await collect(page, true)).toEqual(entry.expected ? [JSON.stringify([{ tag: "H1", text: entry.expected }])] : []);
        });
    }

    for (const tag of ["H1", "H2", "H3", "H4", "H5", "H6"]) {
        test(`retains ${tag} metadata and duplicates`, async ({ page }) => {
            await page.setContent(`<${tag}>Same</${tag}><${tag}>Same</${tag}>`);
            expect(await collect(page, true)).toEqual([JSON.stringify([{ tag, text: "Same" }, { tag, text: "Same" }])]);
        });
    }

    test("takes the first three BFS headings rather than sorting by document order or level", async ({ page }) => {
        await page.setContent("<div><h4>Nested first</h4></div><h2>Shallow first</h2><section><h6>Nested later</h6></section><h1>Shallow second</h1>");
        expect(await collect(page, true)).toEqual([JSON.stringify([
            { tag: "H2", text: "Shallow first" }, { tag: "H1", text: "Shallow second" }, { tag: "H4", text: "Nested first" }
        ])]);
    });

    test("bounds tagged JSON to 610 characters with maximum text escaping", async ({ page }) => {
        await page.setContent("<h1 data-clarity-unmask></h1><h2 data-clarity-unmask></h2><h3 data-clarity-unmask></h3>");
        const text = "\u0001".repeat(30);
        await page.evaluate((value: string) => {
            document.querySelectorAll("h1,h2,h3").forEach(heading => { heading.textContent = value; });
        }, text);
        const values = await collect(page, true);
        expect(values).toEqual([JSON.stringify([{ tag: "H1", text }, { tag: "H2", text }, { tag: "H3", text }])]);
        expect(values[0].length).toBe(610);
    });

    test("does not backfill empty headings", async ({ page }) => {
        await page.setContent("<h1></h1><h2> </h2><h3>Checkout</h3><h4>Not selected</h4>");
        expect(await collect(page, true)).toEqual([JSON.stringify([{ tag: "H3", text: "Checkout" }])]);
    });

    test("does not backfill an entirely empty first three", async ({ page }) => {
        await page.setContent("<h1></h1><h2> </h2><h3>\t</h3><h4>Not selected</h4>");
        expect(await collect(page, true)).toEqual([]);
    });

    test("retains masked first-three slots without taking the fourth", async ({ page }) => {
        await page.setContent("<h1 data-clarity-mask>Private</h1><h2>Order 123</h2><h3 data-clarity-mask>Secret</h3><h4>Not selected</h4>");
        expect(await collect(page, true)).toEqual([JSON.stringify([
            { tag: "H1", text: maskedToken }, { tag: "H2", text: `Order ${digit.repeat(3)}` }, { tag: "H3", text: maskedToken }
        ])]);
    });

    test("honors configured, automatic and inherited target masking", async ({ page }) => {
        await page.setContent("<h1 class='private'>Private</h1><h2 class='contact-details'>Contact</h2><div data-clarity-mask><h3>Secret</h3></div>");
        expect(await collect(page, true, { mask: [".private"] })).toEqual([JSON.stringify([
            { tag: "H1", text: maskedToken }, { tag: "H2", text: maskedToken }, { tag: "H3", text: maskedToken }
        ])]);
    });

    test("retains fully masked values without exceeding 30 UTF-16 units", async ({ page }) => {
        await page.setContent(`<h1 data-clarity-mask>${"A".repeat(30)}</h1>`);
        const text = mask.repeat(5) + (" " + mask.repeat(4)).repeat(5);
        expect(text.length).toBe(30);
        expect(await collect(page, true)).toEqual([JSON.stringify([{ tag: "H1", text }])]);
    });

    test("scrubs the truncated prefix and combines descendant text", async ({ page }) => {
        await page.setContent(`<h1>${"A".repeat(40)} alice@example.com</h1><h2><span>alice</span><span>@</span>example.com</h2><h3>Save 20%</h3>`);
        expect(await collect(page, true)).toEqual([JSON.stringify([
            { tag: "H1", text: "A".repeat(30) }, { tag: "H2", text: email }, { tag: "H3", text: `Save ${digit.repeat(2)}%` }
        ])]);
    });

    test("honors target unmasking, not descendant unmasking", async ({ page }) => {
        await page.setContent("<h1 data-clarity-unmask>Order 123</h1><h2>Order <span data-clarity-unmask>123</span></h2><h3 class='public'>Save 20%</h3>");
        expect(await collect(page, true, { unmask: [".public"] })).toEqual([JSON.stringify([
            { tag: "H1", text: "Order 123" }, { tag: "H2", text: `Order ${digit.repeat(3)}` }, { tag: "H3", text: "Save 20%" }
        ])]);
    });

    test("keeps target-level privacy rather than auditing descendants", async ({ page }) => {
        await page.setContent("<h1>Account <span data-clarity-mask>Alice</span></h1><h2 data-clarity-mask><span data-clarity-unmask>Delivery</span></h2>");
        expect(await collect(page, true)).toEqual([JSON.stringify([
            { tag: "H1", text: "Account Alice" }, { tag: "H2", text: maskedToken }
        ])]);
    });

    test("preserves document text order, currency and ordinary-name heuristics", async ({ page }) => {
        await page.setContent("<h1>A <b>B</b> C</h1><h2>Price $99</h2><h3>Welcome Alice</h3>");
        expect(await collect(page, true)).toEqual([JSON.stringify([
            { tag: "H1", text: "A B C" }, { tag: "H2", text: "Price $99" }, { tag: "H3", text: "Welcome Alice" }
        ])]);
    });

    test("honors content masking and unmask exceptions", async ({ page }) => {
        await page.setContent("<h1>Private</h1><h2 data-clarity-unmask>Checkout</h2><h3 data-clarity-unmask>Order 123</h3>");
        expect(await collect(page, true, { content: false })).toEqual([JSON.stringify([
            { tag: "H1", text: maskedToken }, { tag: "H2", text: "Checkout" }, { tag: "H3", text: "Order 123" }
        ])]);
    });

    test("masks missing privacy records in lean/lite mode", async ({ page }) => {
        await page.setContent("<h1 data-clarity-unmask>Private</h1><h2>Order 123</h2><h3>Checkout</h3>");
        expect(await collect(page, true, { lean: true, lite: true })).toEqual([JSON.stringify([
            { tag: "H1", text: maskedToken }, { tag: "H2", text: maskedToken }, { tag: "H3", text: maskedToken }
        ])]);
    });

    test("ignores iframe documents and shadow-root headings", async ({ page }) => {
        await page.setContent("<div id='host'></div><iframe srcdoc='<h1>Iframe</h1>'></iframe><h2>Light <b>DOM</b></h2>");
        await page.evaluate(() => {
            document.getElementById("host").attachShadow({ mode: "open" }).innerHTML = "<h1>Shadow</h1>";
        });
        expect(await collect(page, true)).toEqual([JSON.stringify([{ tag: "H2", text: "Light DOM" }])]);
    });

    test("buffers three headings during discovery without uploading unsampled values or rescanning on request", async ({ page }) => {
        await page.setContent("<h1>Heading</h1>".repeat(200));
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
        })).toEqual([JSON.stringify(Array(3).fill({ tag: "H1", text: "Heading" }))]);
        expect(await page.evaluate(() => (window as CaptureWindow).headingTextReads)).toBe(6);
    });

    test("keeps discovery-time text when the DOM changes before the response", async ({ page }) => {
        await page.setContent("<h1>Original</h1>");
        expect(await collect(page, true, {}, undefined, async current => {
            await current.evaluate(() => { document.querySelector("h1").textContent = "Changed"; });
        })).toEqual([JSON.stringify([{ tag: "H1", text: "Original" }])]);
    });

    for (const count of [1, 2, 3]) {
        test(`waits for discovery of ${count} headings when HEADINGS arrives during suspension`, async ({ page }) => {
            const entries = [
                { tag: "H1", text: "First" }, { tag: "H2", text: "Second" }, { tag: "H3", text: "Third" }
            ].slice(0, count);
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
                await expect.poll(() => current.evaluate(() => (window as CaptureWindow).headingTextReads)).toBe(count);
                await current.waitForTimeout(50);
            })).toEqual([JSON.stringify(entries)]);
        });
    }

    test("does not fill an empty initial buffer from later lite-upgrade discovery", async ({ page }) => {
        await page.setContent("<p>No initial headings</p>");
        expect(await collect(page, true, { lean: true, lite: true }, undefined, async current => {
            await current.evaluate(() => {
                document.body.insertAdjacentHTML("beforeend", "<h1>Too late</h1>");
                (window as CaptureWindow).clarity("upgrade", "before-headings-response");
            });
            await current.waitForTimeout(100);
        })).toEqual([]);
    });

    test("does not refresh after capture on mutations or upgrade", async ({ page }) => {
        await page.setContent("<h1>Original</h1>");
        expect(await collect(page, true, { lean: true }, async current => {
            await current.evaluate(() => {
                document.querySelector("h1").textContent = "Changed";
                (window as CaptureWindow).clarity("upgrade", "headings-test");
            });
            await current.waitForTimeout(100);
        })).toEqual([JSON.stringify([{ tag: "H1", text: "Original" }])]);
    });

    test("sends headings with the next ordinary upload before stop", async ({ page }) => {
        await page.setContent("<h1>Checkout</h1>");
        expect(await collect(page, true, {}, async current => {
            const next = current.waitForResponse(response =>
                response.url() === upload && extract([response.request().postData()]).length > 0);
            await current.evaluate(() => (window as CaptureWindow).clarity("event", "after-headings"));
            const uploaded = await next;
            expect(JSON.parse(uploaded.request().postData()).e[9]).toBe(0);
        })).toEqual([JSON.stringify([{ tag: "H1", text: "Checkout" }])]);
    });

    test("emits nothing on pages without headings", async ({ page }) => {
        await page.setContent("<p>No headings</p>");
        expect(await collect(page, true)).toEqual([]);
    });

    test("does not retain values across starts", async ({ page }) => {
        await page.setContent("<h1>First</h1>");
        expect(await collect(page, true)).toEqual([JSON.stringify([{ tag: "H1", text: "First" }])]);
        await page.setContent("<h2>Second</h2>");
        expect(await collect(page, true)).toEqual([JSON.stringify([{ tag: "H2", text: "Second" }])]);
    });

    test("does not retain an unsampled buffer across starts", async ({ page }) => {
        await page.setContent("<h1>Not requested</h1>");
        expect(await collect(page, false)).toEqual([]);
        await page.setContent("<h2>Restarted</h2>");
        expect(await collect(page, true)).toEqual([JSON.stringify([{ tag: "H2", text: "Restarted" }])]);
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
        await expect.poll(() => extract(payloads)).toEqual([JSON.stringify([
            { tag: "H2", text: "Restarted" }, { tag: "H3", text: "Second" }, { tag: "H4", text: "Third" }
        ])]);
        expect(errors).toEqual([]);
    });

    for (const build of [
        { file: "clarity.min.js", enabled: true },
        { file: "clarity.extended.js", enabled: true },
        { file: "clarity.insight.js", enabled: false },
        { file: "clarity.performance.js", enabled: false }
    ]) {
        test(`${build.file} handles HEADINGS without changing lean replay behavior`, async ({ page }) => {
            await page.setContent("<h1>Checkout</h1>");
            const values = await collect(page, true, { lean: true }, undefined, undefined, build.file);
            expect(values).toEqual(build.enabled ? [JSON.stringify([{ tag: "H1", text: "Checkout" }])] : []);
        });
    }
});
