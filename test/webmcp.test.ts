import { test, expect, type Page } from "@playwright/test";
import { decode } from "clarity-decode";
import { readFileSync } from "fs";
import { resolve } from "path";
import { pathToFileURL } from "url";
import "./helper";

const core = readFileSync(resolve(__dirname, "../packages/clarity-js/build/clarity.min.js"), "utf8");
const webMcpDimension = 41;
type Context = "object" | "function" | "undefined" | "null" | "primitive" | "throw" | "inherited";

declare global {
    interface Window {
        webMcpReads: number[];
        webMcpConsoleCalls: number;
    }
}

async function start(page: Page, contexts: readonly [Context, Context]): Promise<void> {
    await page.goto(pathToFileURL(resolve(__dirname, "./html/core.html")).toString());
    await page.clock.install();
    await page.evaluate(contexts => {
        window.payloads = [];
        window.webMcpReads = [0, 0];
        window.webMcpConsoleCalls = 0;
        console.warn = console.error = () => { window.webMcpConsoleCalls++; };
        [document, navigator].forEach((target, i) => {
            const kind = contexts[i];
            Object.defineProperty(target, "modelContext", { configurable: true, value: undefined });
            if (kind === "inherited") {
                Reflect.deleteProperty(target, "modelContext");
                target = Object.getPrototypeOf(target);
            }
            Object.defineProperty(target, "modelContext", {
                configurable: true,
                get() {
                    window.webMcpReads[i]++;
                    if (kind === "throw") { throw new Error("Unreadable modelContext"); }
                    if (kind === "undefined") { return undefined; }
                    if (kind === "null") { return null; }
                    if (kind === "primitive") { return "placeholder"; }
                    if (kind === "function") { return () => { throw new Error("Must not invoke context"); }; }
                    return { get getTools() { throw new Error("Must not inspect tools"); } };
                },
            });
        });
    }, contexts);
    await page.addScriptTag({ content: core });
    await page.evaluate(() => window.clarity("start", {
        projectId: "test", delay: 10, upload: (payload: string) => window.payloads.push(payload),
    }));
    await page.clock.runFor(100);
}

async function values(page: Page): Promise<string[]> {
    return (await page.evaluate(() => window.payloads))
        .flatMap(payload => decode(payload).dimension || [])
        .flatMap(event => event.data[webMcpDimension] || []);
}

test.describe("WebMCP metadata", () => {
    const cases = [
        ["document first", "object", "throw", true, [1, 0]],
        ["navigator fallback", "undefined", "object", true, [1, 1]],
        ["document function", "function", "undefined", true, [1, 0]],
        ["navigator function", "undefined", "function", true, [1, 1]],
        ["inherited navigator context", "undefined", "inherited", true, [1, 1]],
        ["absent contexts", "undefined", "undefined", false, [1, 1]],
        ["null contexts", "null", "null", false, [1, 1]],
        ["primitive placeholders", "primitive", "primitive", false, [1, 1]],
        ["throwing document with navigator fallback", "throw", "object", true, [1, 1]],
        ["throwing navigator", "undefined", "throw", false, [1, 1]],
        ["both getters throwing", "throw", "throw", false, [1, 1]],
    ] as const;

    for (const [name, documentContext, navigatorContext, detected, reads] of cases) {
        test(name, async ({ page }) => {
            const errors: string[] = [];
            page.on("pageerror", error => errors.push(error.message));
            await start(page, [documentContext, navigatorContext]);
            const uploads = await page.evaluate(() => window.payloads.length);
            expect(uploads).toBeGreaterThan(0);
            await page.evaluate(() => window.clarity("event", "webmcp-test", "flush"));
            await page.clock.runFor(7000);
            await page.evaluate(() => window.clarity("stop"));
            expect(await page.evaluate(() => window.payloads.length)).toBeGreaterThan(uploads);
            expect(await values(page)).toEqual(detected ? ["1"] : []);
            expect(await page.evaluate(() => window.webMcpReads)).toEqual(reads);
            expect(await page.evaluate(() => window.webMcpConsoleCalls)).toBe(0);
            expect(errors).toEqual([]);
            const dimensions = (await page.evaluate(() => window.payloads))
                .flatMap(payload => decode(payload).dimension || []);
            expect(dimensions.some(event => event.data[0]?.length && event.data[1]?.length)).toBe(true);
        });
    }

    test("late publication is detected only after a new page lifecycle", async ({ page }) => {
        await start(page, ["undefined", "undefined"]);
        await page.evaluate(() => Object.defineProperty(document, "modelContext", { value: {} }));
        await page.clock.runFor(7000);
        await page.evaluate(() => window.clarity("stop"));
        expect(await values(page)).toEqual([]);
        await page.evaluate(() => window.clarity("start"));
        await page.clock.runFor(100);
        await page.evaluate(() => window.clarity("stop"));
        expect(await values(page)).toEqual(["1"]);
    });
});
