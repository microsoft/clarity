import { expect, Page, Route, test } from "@playwright/test";
import { join } from "path";
import { decode } from "clarity-decode";
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

    test("collects three normalized document-order headings with a 60-UTF-16-unit text cap", async ({ page }) => {
        await page.setContent("<h0>Invalid</h0><h7>Invalid</h7><h10>Invalid</h10><a1>Invalid</a1>" +
            `<div><h4 data-clarity-unmask>${"a".repeat(59)}\ud83d\udca1</h4></div><h1 data-clarity-unmask>${"a".repeat(59)}` +
            "<span> \t </span><b>Later</b></h1><h1> Same\r\n\t123 </h1>" +
            `<h6 data-clarity-unmask>${"a".repeat(59)}\ud83d\udca1</h6>`);
        expect(await collect(page, true)).toEqual([
            `H4:${"a".repeat(59)}\ud83d\nH1:${"a".repeat(59)}\nH1:Same ${digit.repeat(3)}`
        ]);
        await page.setContent([1, 2, 3].map(level => `<h${level} data-clarity-unmask>${"a".repeat(61)}</h${level}>`).join(""));
        const maximum = [1, 2, 3].map(level => `H${level}:${"a".repeat(60)}`).join("\n");
        expect(maximum.length).toBe(191);
        expect(await collect(page, true)).toEqual([maximum]);
    });

    test("normalizes once after the scrubbed-text budget and scrubs complete source tokens", async ({ page }) => {
        await page.setContent(`<h1 data-clarity-unmask>${" ".repeat(60)}<span>Outside budget</span></h1>` +
            "<h2 data-clarity-unmask> A<span> \t\n </span><em>B</em> </h2>" +
            `<h3>${"a".repeat(80)}1</h3>`);
        expect(await collect(page, true)).toEqual([`H1:\nH2:A B\nH3:${"\u25aa".repeat(60)}`]);

        await page.setContent(`<h1>${"a".repeat(60)}@example.com</h1>` +
            `<h2>${"a".repeat(60)} @example.com</h2>` +
            `<h3 data-clarity-unmask>${"a".repeat(60)}@example.com</h3>`);
        expect(await collect(page, true)).toEqual([
            `H1:${"\u25aa".repeat(60)}\nH2:${"a".repeat(60)}\nH3:${"a".repeat(60)}`
        ]);
    });

    test("keeps the first three eligible headings even when empty or fully masked", async ({ page }) => {
        await page.setContent("<h1> </h1><h2 data-clarity-mask>Private</h2>" +
            "<h3>Third</h3><h4>Fourth</h4><h5>Fifth</h5><h6>Sixth</h6>");
        expect(await collect(page, true)).toEqual([`H1:\nH2:${mask} ${mask.repeat(5)}\nH3:Third`]);

        await page.setContent("<div>" + "<h2> </h2>".repeat(3) + "</div><h1>Outside document-order budget</h1>");
        expect(await collect(page, true)).toEqual(["H2:\nH2:\nH2:"]);

        await page.setContent("<h1>First</h1><h2>Second</h2><h3>Third</h3><h4>Fourth</h4>");
        expect(await collect(page, true, { content: false })).toEqual([
            `H1:${mask.repeat(5)}\nH2:${mask.repeat(6)}\nH3:${mask.repeat(5)}`
        ]);
    });

    test("bounds full source text at 1000 work units and does not backfill oversized candidates", async ({ page }) => {
        await page.setContent(`<h1>${"a".repeat(998)}</h1><h2>${"a".repeat(999)}</h2>` +
            "<h3>Third</h3><h4>Outside candidate budget</h4>");
        expect(await collect(page, true)).toEqual([`H1:${"a".repeat(60)}\nH3:Third`]);

        await page.setContent(`<h1>A<span>${"b".repeat(995)}</span></h1>` +
            `<h2>A<span>${"b".repeat(996)}</span></h2><h3>Third</h3>`);
        expect(await collect(page, true)).toEqual([`H1:A${"b".repeat(59)}\nH3:Third`]);

        await page.setContent("<h1>" + "a".repeat(10000) + "</h1>" +
            "<h2>" + "b".repeat(10000) + "</h2><h3>" + "c".repeat(10000) + "</h3><h4>No replacement</h4>");
        expect(await collect(page, true)).toEqual([]);
    });

    test("bounds queued children even when descendants contribute no text", async ({ page }) => {
        await page.setContent("<h1>" + "<span></span>".repeat(997) + "X</h1>" +
            "<h2>" + "<span></span>".repeat(998) + "X</h2>" +
            "<h3>Early" + "<span></span>".repeat(1000) + "</h3><h4>No replacement</h4>");
        expect(await collect(page, true)).toEqual(["H1:X"]);
    });

    test("bounds deep empty descendants as well as wide child lists", async ({ page }) => {
        await page.setContent("<h1></h1><h2></h2><h3>Third</h3><h4>No replacement</h4>");
        await page.evaluate(() => {
            for (let i = 0; i < 2; i++) {
                let parent: Element = document.querySelector(i === 0 ? "h1" : "h2");
                for (let depth = 0; depth < 999 + i; depth++) {
                    parent = parent.appendChild(document.createElement("span"));
                }
            }
        });
        expect(await collect(page, true)).toEqual(["H1:\nH3:Third"]);
    });

    test("excludes iframe and shadow headings from the main-document candidates", async ({ page }) => {
        await page.setContent('<iframe></iframe><div id="shadow"></div><h1 data-clarity-unmask>Main</h1>');
        await page.evaluate((): void => {
            document.querySelector("iframe").contentDocument.body.innerHTML = "<h1 data-clarity-unmask>Frame</h1>";
            document.querySelector("#shadow").attachShadow({ mode: "open" }).innerHTML =
                "<h1 data-clarity-unmask>Shadow</h1>";
        });
        expect(await collect(page, true)).toEqual(["H1:Main"]);
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
            `H1:Welcome ${mask.repeat(2)} ${mask.repeat(5)} ${mask.repeat(5)} to Clarity today` +
            `\nH2:onetwothree\nH3:A ${mask.repeat(6)} B`
        ]);

        await page.setContent("<h1 data-clarity-mask>Hidden <span data-clarity-unmask>Public 123</span> tail</h1>" +
            "<h2>Order <span data-clarity-unmask>123</span> reference 456</h2>" +
            "<h3 class='private'>Hidden <span class='public'>Configured public 123</span></h3>");
        const privacy = { mask: [".private"], unmask: [".public"] };
        expect(await collect(page, false, privacy)).toEqual([]);
        expect(await collect(page, true, privacy)).toEqual([
            `H1:${mask.repeat(6)}Public 123${mask.repeat(4)}\nH2:Order 123 reference ${digit.repeat(3)}` +
            `\nH3:${mask.repeat(6)}Configured public 123`
        ]);
    });

    test("matches replay placeholders without exposing masked word boundaries", async ({ page }) => {
        await page.setContent('<h1>Welcome <span id="first" data-clarity-mask> Ada\tLovelace </span>!</h1>' +
            '<h2>Welcome <span id="second" data-clarity-mask>Abcdefghijkl</span>!</h2>' +
            '<h3 data-clarity-unmask>Public 123</h3>');
        const placeholder = `${mask.repeat(6)} ${mask.repeat(5)}`;
        const values = await collect(page, true, {}, async (_page, payloads) => {
            const nodes = payloads.flatMap(payload => (decode(payload).dom || []).flatMap(event => event.data));
            for (const id of ["first", "second"]) {
                const span = nodes.find(node => node.attributes?.id === id);
                expect(span).toBeDefined();
                const text = nodes.find(node => node.parent === span.id && node.tag === "*T");
                expect(text?.value).toBe(placeholder);
            }
        });
        expect(values).toEqual([`H1:Welcome ${placeholder}!\nH2:Welcome ${placeholder}!\nH3:Public 123`]);

        await page.setContent(`<h1 data-clarity-mask>${"a".repeat(80)}</h1>`);
        const prefix = `${mask.repeat(2)}${` ${mask.repeat(5)}`.repeat(9)} ${mask.repeat(3)}`;
        expect(prefix.length).toBe(60);
        expect(await collect(page, true)).toEqual([`H1:${prefix}`]);
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
