import { expect, Page, Route, test } from "@playwright/test";
import { join } from "path";
import { Config } from "../types/core";

const origin = "https://clarity.test/";
const upload = `${origin}collect`;
const mask = "\u2022";
const digit = "\u25ab";

type CaptureWindow = typeof window & {
    clarity: (command: "start" | "stop", config?: Config) => void;
    headingQueries: number;
};

async function collect(
    page: Page, sampled: boolean, config: Partial<Config> = {},
    beforeResponse?: (page: Page) => Promise<void>
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
    await page.addScriptTag({ path: join(__dirname, "..", "build", "clarity.min.js") });
    await page.evaluate((settings: { endpoint: string; config: Partial<Config> }): void => {
        (window as CaptureWindow).clarity("start", {
            projectId: "test", track: false, delay: 50, upload: settings.endpoint, ...settings.config,
            action: (value: string): void => document.documentElement.setAttribute("data-headings-response", value)
        });
    }, { endpoint: upload, config });
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

    test("collects three document-order H1-H3 headings with a 60-UTF-16-unit text cap", async ({ page }) => {
        await page.setContent("<h0>Invalid</h0><h7>Invalid</h7><h10>Invalid</h10><a1>Invalid</a1>" +
            `<h4>Ignored</h4><div><h3 data-clarity-unmask>${"a".repeat(59)}\ud83d\udca1</h3></div>` +
            `<h1 data-clarity-unmask>${"a".repeat(59)}` +
            "<span> \t </span><b>Later</b></h1><h1> Same\r\n\t123 </h1>" +
            "<h6>Ignored</h6>");
        expect(await collect(page, true)).toEqual([
            `H3:${"a".repeat(59)}\ud83d~~H1:${"a".repeat(59)} ~~H1: Same\n\t${digit.repeat(3)} `
        ]);
        await page.setContent([1, 2, 3].map(level => `<h${level} data-clarity-unmask>${"a".repeat(61)}</h${level}>`).join(""));
        const maximum = [1, 2, 3].map(level => `H${level}:${"a".repeat(60)}`).join("~~");
        expect(await collect(page, true)).toEqual([maximum]);

        await page.setContent(`<h1 data-clarity-unmask>${"a".repeat(58)}\ud83d\udca1</h1>` +
            `<h2 data-clarity-unmask>${"a".repeat(58)} \ud83d\udca1</h2>`);
        expect(await collect(page, true)).toEqual([`H1:${"a".repeat(58)}\ud83d\udca1~~H2:${"a".repeat(58)} \ud83d`]);
    });

    test("preserves whitespace and scrubs source text beyond the output cap", async ({ page }) => {
        await page.setContent(`<h1 data-clarity-unmask>${" ".repeat(60)}<span>Outside budget</span></h1>` +
            "<h2 data-clarity-unmask> A<span> \t\n </span><em>B</em> </h2>" +
            `<h3>${"a".repeat(80)}1</h3>`);
        expect(await collect(page, true)).toEqual([`H1:${" ".repeat(60)}~~H2: A \t\n B ~~H3:${"\u25aa".repeat(60)}`]);

        await page.setContent(`<h1>${"a".repeat(60)}@example.com</h1>` +
            `<h2>${"a".repeat(60)} @example.com</h2>` +
            `<h3 data-clarity-unmask>${"a".repeat(60)}@example.com</h3>`);
        expect(await collect(page, true)).toEqual([
            `H1:${"\u25aa".repeat(60)}~~H2:${"a".repeat(60)}~~H3:${"a".repeat(60)}`
        ]);
    });

    test("keeps the first three heading candidates even when empty or fully masked", async ({ page }) => {
        await page.setContent("<h1> </h1><h2 data-clarity-mask>Private</h2>" +
            "<h3>Third</h3><h4>Fourth</h4><h5>Fifth</h5><h6>Sixth</h6>");
        expect(await collect(page, true)).toEqual([`H1: ~~H2:${mask}~~H3:Third`]);

        await page.setContent("<h1>First</h1><h2>Second</h2><h3>Third</h3><h4>Fourth</h4>");
        expect(await collect(page, true, { content: false })).toEqual([
            `H1:${mask}~~H2:${mask}~~H3:${mask}`
        ]);
    });

    test("checks current candidates only on request and does not replace uncached ones", async ({ page }) => {
        for (const [sampled, lean] of [[false, true], [true, false], [true, true]] as const) {
            await page.goto(origin);
            await page.setContent("<h1>First</h1><h2>Second</h2><h3>Third</h3>");
            await page.evaluate(() => {
                const current = window as CaptureWindow;
                const query = document.querySelectorAll.bind(document);
                current.headingQueries = 0;
                Object.defineProperty(document, "querySelectorAll", {
                    configurable: true,
                    value(selector: string): NodeListOf<Element> {
                        if (selector === "h1,h2,h3") {
                            current.headingQueries++;
                            // Insert synchronously so mutation tracking cannot cache this candidate before collection.
                            document.body.insertAdjacentHTML("afterbegin", "<h3>Uncached</h3>");
                        }
                        return query(selector);
                    }
                });
            });
            const values = await collect(page, sampled, { lean }, async current => {
                expect(await current.evaluate(() => (window as CaptureWindow).headingQueries)).toBe(0);
            });
            expect(values).toEqual(sampled && !lean ? ["H1:First~~H2:Second"] : []);
            expect(await page.evaluate(() => (window as CaptureWindow).headingQueries)).toBe(sampled && !lean ? 1 : 0);
        }
    });

    test("limits each source text node to 1000 units before scrubbing", async ({ page }) => {
        await page.setContent(`<h1>${"a".repeat(999)}1</h1>` +
            `<h2>${"a".repeat(1000)}1</h2><h3>${"a".repeat(1000)}@example.com</h3>`);
        expect(await collect(page, true)).toEqual([
            `H1:${"\u25aa".repeat(60)}~~H2:${"a".repeat(60)}~~H3:${"a".repeat(60)}`
        ]);
    });

    test("caps wide and deep traversal at the tenth node while retaining partial text", async ({ page }) => {
        await page.setContent("<h1>A" + "<span></span>".repeat(7) + "B</h1>" +
            "<h2>A" + "<span></span>".repeat(8) + "B</h2>" +
            "<h3>A" + "<span>".repeat(8) + "B" + "</span>".repeat(8) + "</h3>");
        expect(await collect(page, true)).toEqual(["H1:AB~~H2:A~~H3:A"]);
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

    test("includes cached shadow and iframe descendants with per-node privacy", async ({ page }) => {
        await page.setContent('<h1 data-clarity-unmask><div id="shadow"></div> Tail</h1>' +
            '<h2 data-clarity-unmask><iframe></iframe> Tail</h2>');
        await page.evaluate((): void => {
            document.querySelector("#shadow").attachShadow({ mode: "open" }).innerHTML =
                '<span data-clarity-unmask>Shadow </span><span data-clarity-mask>SHADOW_PRIVATE</span>';
            document.querySelector("iframe").contentDocument.body.innerHTML =
                '<span data-clarity-unmask>Frame </span><span data-clarity-mask>FRAME_PRIVATE</span>';
        });
        expect(await collect(page, true)).toEqual([`H1:Shadow ${mask} Tail~~H2:Frame ${mask} Tail`]);
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
            `H1: Welcome ${mask}  to Clarity today ~~H2:onetwothree~~H3:A ${mask} B`
        ]);

        await page.setContent("<h1 data-clarity-mask>Hidden <span data-clarity-unmask>Public 123</span> tail</h1>" +
            "<h2>Order <span data-clarity-unmask>123</span> reference 456</h2>" +
            "<h3 class='private'>Hidden <span class='public'>Configured public 123</span></h3>");
        const privacy = { mask: [".private"], unmask: [".public"] };
        expect(await collect(page, true, privacy)).toEqual([
            `H1:${mask}Public 123${mask}~~H2:Order 123 reference ${digit.repeat(3)}` +
            `~~H3:${mask}Configured public 123`
        ]);
    });

    test("uses a fixed marker without exposing masked text length or word boundaries", async ({ page }) => {
        await page.setContent('<h1>Welcome <span data-clarity-mask> Ada\tLovelace </span>!</h1>' +
            '<h2>Welcome <span data-clarity-mask>A much longer private phrase</span>!</h2>' +
            '<h3 data-clarity-unmask>Public 123</h3>');
        expect(await collect(page, true)).toEqual([`H1:Welcome ${mask}!~~H2:Welcome ${mask}!~~H3:Public 123`]);

        await page.setContent(`<h1 data-clarity-mask>${"a".repeat(80)}</h1>` +
            `<h2 data-clarity-mask> \t\n </h2><h3 data-clarity-mask>${"a".repeat(999)}</h3>`);
        expect(await collect(page, true)).toEqual([`H1:${mask}~~H2:~~H3:${mask}`]);
    });
});
