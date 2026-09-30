import { expect, Page, test } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";
import { Config } from "../types/core";

const clarityJsPath = join(__dirname, "../build/clarity.min.js");
const DimensionEvent = 1;
const PageHeadingsDimension = 41;

type CaptureWindow = typeof window & {
    clarity: {
        (command: "start" | "stop", config?: Config): void;
        (command: "upgrade", key: string): void;
    };
    headingPayloads: string[];
    headingTextReads: number;
};

async function collect(
    page: Page, enabled: boolean, config: Config = {}, afterCapture?: (page: Page) => Promise<void>
): Promise<string[]> {
    const clarityJs = readFileSync(clarityJsPath, "utf-8");
    await page.addScriptTag({ content: clarityJs });
    await page.evaluate(async ({ pageHeadings, options }: { pageHeadings: boolean; options: Config }): Promise<void> => {
        const capture = window as CaptureWindow;
        capture.headingPayloads = [];
        capture.clarity("start", {
            projectId: "test",
            track: false,
            delay: 50,
            ...options,
            pageHeadings,
            upload: (payload: string): void => { capture.headingPayloads.push(payload); }
        });
        await new Promise<void>((resolve): number => window.setTimeout(resolve, 400));
    }, { pageHeadings: enabled, options: config });

    if (afterCapture) {
        await afterCapture(page);
    }
    const payloads = await page.evaluate((): string[] => {
        const capture = window as CaptureWindow;
        capture.clarity("stop");
        return capture.headingPayloads;
    });
    return extract(payloads);
}

function extract(payloads: string[]): string[] {
    const values: string[] = [];
    for (const payload of payloads) {
        const events = (JSON.parse(payload) as { a?: (number | string | string[])[][] }).a || [];
        for (const tokens of events) {
            if (tokens[1] !== DimensionEvent) {
                continue;
            }
            for (let i = 2; i < tokens.length - 1; i += 2) {
                if (tokens[i] === PageHeadingsDimension) {
                    const entries = tokens[i + 1];
                    expect(Array.isArray(entries)).toBe(true);
                    if (Array.isArray(entries)) {
                        values.push(...entries);
                    }
                }
            }
        }
    }
    return values;
}

test.describe("page headings", () => {
    test.beforeEach(async ({ page }) => {
        await page.route("**/*", (route) => route.abort());
    });

    const cases = [
        { name: "preserves ordinary text", input: "Checkout", expected: "Checkout" },
        { name: "omits empty text", input: "", expected: "" },
        { name: "omits whitespace-only text", input: " \t\r\n\u00a0 ", expected: "" },
        { name: "collapses and trims whitespace", input: " \tAlpha\u00a0  Beta\r\nGamma ", expected: "Alpha Beta Gamma" },
        { name: "truncates normalized text", input: " \t" + "long".repeat(20), expected: "long".repeat(20).substring(0, 30) },
        { name: "omits text changed by scrubbing", input: "Order 123 alice@example.com", expected: "" }
    ];

    for (const entry of cases) {
        test(entry.name, async ({ page }) => {
            await page.setContent("<h1></h1>");
            await page.evaluate((value: string): void => { document.querySelector("h1").textContent = value; }, entry.input);

            expect(await collect(page, true)).toEqual(entry.expected ? [JSON.stringify([entry.expected])] : []);
        });
    }

    test("captures the first three non-empty headings in document order", async ({ page }) => {
        await page.setContent(`
            <div><h1>  First   heading  </h1></div>
            <h2>Second heading</h2>
            <section><h3>Third heading with more than thirty characters</h3></section>
            <h4>Fourth heading</h4>
        `);

        const values = await collect(page, true);

        expect(values).toEqual([
            JSON.stringify(["First heading", "Second heading", "Third heading with more than t"])
        ]);
    });

    test("skips empty and shadow-root headings", async ({ page }) => {
        await page.setContent("<h1> </h1><div id='host'></div><h2>Visible</h2>");
        await page.evaluate(() => {
            const root = document.getElementById("host").attachShadow({ mode: "open" });
            root.innerHTML = "<h1>Shadow heading</h1>";
        });

        const values = await collect(page, true);

        expect(values).toEqual([JSON.stringify(["Visible"])]);
    });

    test("emits nothing when disabled or when no headings exist", async ({ page }) => {
        await page.setContent("<h1>Disabled</h1>");
        expect(await collect(page, false)).toEqual([]);

        await page.setContent("<p>No headings</p>");
        expect(await collect(page, true)).toEqual([]);
    });

    test("rejects masked heading targets, then fills from later headings", async ({ page }) => {
        await page.setContent(`
            <h1 data-clarity-mask>Masked heading</h1>
            <div data-clarity-mask><h3>Inherited mask</h3></div>
            <div><h4>Checkout</h4></div>
            <h5>Delivery</h5>
            <h6>Payment</h6>
            <h2>Later heading</h2>
        `);

        expect(await collect(page, true)).toEqual([JSON.stringify(["Checkout", "Delivery", "Payment"])]);
    });

    test("honors configured masking and automatic class masking", async ({ page }) => {
        await page.setContent(`
            <h1 class="private-heading">Private</h1>
            <h2 class="contact-details">Contact</h2>
            <h3>Public</h3>
        `);

        expect(await collect(page, true, { mask: [".private-heading"] })).toEqual([JSON.stringify(["Public"])]);
    });

    test("checks only the captured prefix while combining text across child elements", async ({ page }) => {
        await page.setContent(`
            <h1>${"A".repeat(40)} alice@example.com</h1>
            <h2><span>alice</span><span>@</span><span>example.com</span></h2>
            <h3>Summer sale <span>2026</span></h3>
            <h4>Checkout</h4>
        `);

        expect(await collect(page, true)).toEqual([JSON.stringify(["A".repeat(30), "Checkout"])]);
    });

    test("honors heading unmask settings but not a child's unmask setting", async ({ page }) => {
        await page.setContent(`
            <h1 data-clarity-unmask>Order 12345</h1>
            <h2>Order <span data-clarity-unmask>12345</span></h2>
            <h3><span data-clarity-unmask>alice</span><span>@</span><span>example.com</span></h3>
            <h4 class="public-heading">Save 20%</h4>
            <h5>Checkout</h5>
        `);

        expect(await collect(page, true, { unmask: [".public-heading"] })).toEqual([
            JSON.stringify(["Order 12345", "Save 20%", "Checkout"])
        ]);
    });

    test("uses the heading's privacy rather than its children's mask or unmask settings", async ({ page }) => {
        await page.setContent(`
            <div data-clarity-mask><h1 data-clarity-unmask>Checkout</h1></div>
            <h2>Account <span data-clarity-mask>Alice</span></h2>
            <h3 data-clarity-mask><span data-clarity-unmask>Delivery</span></h3>
            <h4 data-clarity-unmask>Contact <span data-clarity-mask>Alice</span></h4>
        `);

        expect(await collect(page, true)).toEqual([JSON.stringify(["Checkout", "Account Alice", "Contact Alice"])]);
    });

    test("uses document text order and preserves duplicate headings", async ({ page }) => {
        await page.setContent("<h1>A <b>B</b> C</h1><h2>Same</h2><h3>Same</h3>");

        expect(await collect(page, true)).toEqual([JSON.stringify(["A B C", "Same", "Same"])]);
    });

    test("keeps existing currency and ordinary-name heuristic behavior", async ({ page }) => {
        await page.setContent("<h1>Welcome Alice</h1><h2>Price $99</h2><h3>Save 20%</h3>");

        expect(await collect(page, true)).toEqual([JSON.stringify(["Welcome Alice", "Price $99"])]);
    });

    test("uses privacy records when lean mode buffers replay", async ({ page }) => {
        await page.setContent("<h1 data-clarity-mask>Private</h1><h2>Order 123</h2><h3>Checkout</h3>");

        expect(await collect(page, true, { lean: true })).toEqual([JSON.stringify(["Checkout"])]);
    });

    test("does not fall back to raw text when lean and lite leave privacy records unavailable", async ({ page }) => {
        await page.setContent("<h1 data-clarity-mask>Private</h1><h2>Order 123</h2><h3>Checkout</h3>");

        expect(await collect(page, true, { lean: true, lite: true })).toEqual([]);
    });

    test("omits the dimension when every heading is rejected", async ({ page }) => {
        await page.setContent("<h1 data-clarity-mask>Private</h1><h2>Order 123</h2>");

        expect(await collect(page, true)).toEqual([]);
    });

    test("respects content masking and heading unmask exceptions", async ({ page }) => {
        await page.setContent(`
            <h1>Masked by default</h1>
            <h2 data-clarity-unmask>Checkout</h2>
            <h3 data-clarity-unmask>Order 123</h3>
        `);

        expect(await collect(page, true, { content: false })).toEqual([JSON.stringify(["Checkout", "Order 123"])]);
    });

    test("excludes iframe and shadow text within otherwise eligible headings", async ({ page }) => {
        await page.setContent(`
            <h1>Light <span id="host"></span>heading<iframe srcdoc="<h2>Order 123</h2>"></iframe></h1>
            <h2>Next</h2>
        `);
        await page.evaluate((): void => {
            document.getElementById("host").attachShadow({ mode: "open" }).innerHTML = "<h1>Order 123</h1>";
        });
        await page.waitForFunction((): boolean => document.querySelector("iframe").contentDocument.readyState === "complete");

        expect(await collect(page, true)).toEqual([JSON.stringify(["Light heading", "Next"])]);
    });

    test("avoids text reads for later headings once three earlier headings qualify", async ({ page }) => {
        await page.setContent("<h1>Heading</h1>".repeat(200));
        await page.evaluate((): void => {
            const capture = window as CaptureWindow;
            const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
            capture.headingTextReads = 0;
            Object.defineProperty(HTMLHeadingElement.prototype, "textContent", {
                configurable: true,
                get(this: HTMLHeadingElement): string {
                    capture.headingTextReads++;
                    return descriptor.get.call(this);
                },
                set: descriptor.set
            });
        });

        expect(await collect(page, false)).toEqual([]);
        expect(await page.evaluate((): number => (window as CaptureWindow).headingTextReads)).toBe(0);
        expect(await collect(page, true)).toEqual([JSON.stringify(["Heading", "Heading", "Heading"])]);
        expect(await page.evaluate((): number => (window as CaptureWindow).headingTextReads)).toBe(3);
    });

    test("does not refresh the initial snapshot on mutations", async ({ page }) => {
        await page.setContent("<h1>Original</h1>");

        const values = await collect(page, true, {}, async (current: Page): Promise<void> => {
            await current.evaluate((): void => {
                document.querySelector("h1").textContent = "Changed";
                document.body.insertAdjacentHTML("beforeend", "<h2>Later</h2>");
            });
            await current.waitForTimeout(100);
        });

        expect(values).toEqual([JSON.stringify(["Original"])]);
    });

    test("does not collect later headings when lite mode upgrades", async ({ page }) => {
        await page.setContent("<h1>Original</h1>");

        const values = await collect(page, true, { lean: true, lite: true }, async (current: Page): Promise<void> => {
            await current.evaluate((): void => {
                document.querySelector("h1").textContent = "Changed";
                (window as CaptureWindow).clarity("upgrade", "headings-test");
            });
            await current.waitForTimeout(400);
        });

        expect(values).toEqual([]);
    });

    test("resets rejected candidate state between starts", async ({ page }) => {
        await page.setContent("<h1 data-clarity-mask>Private</h1>");
        expect(await collect(page, true)).toEqual([]);

        await page.setContent("<h1>Checkout</h1>");
        expect(await collect(page, true)).toEqual([JSON.stringify(["Checkout"])]);
    });

    test("does not let cancelled discovery consume the next lifecycle's candidates", async ({ page }) => {
        await page.setContent("<h1>Original</h1>");
        await page.addScriptTag({ content: readFileSync(clarityJsPath, "utf-8") });
        const payloads = await page.evaluate(async (): Promise<string[]> => {
            const capture = window as CaptureWindow;
            const output: string[] = [];
            const options: Config = {
                projectId: "test", track: false, delay: 50, pageHeadings: true,
                upload: (payload: string): void => { output.push(payload); }
            };
            capture.clarity("start", options);
            capture.clarity("stop");
            document.body.innerHTML = "<h1>Restarted</h1>";
            capture.clarity("start", options);
            await new Promise<void>((resolve): number => window.setTimeout(resolve, 400));
            capture.clarity("stop");
            return output;
        });

        expect(extract(payloads)).toEqual([JSON.stringify(["Restarted"])]);
    });
});
