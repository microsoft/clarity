import { expect, Page, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import type { Token } from "../types/webmcp";

const source = readFileSync(resolve(__dirname, "../build/dynamic/clarity.webmcp.js"), "utf8");

interface Fixture {
  records: Token[][];
  stops: (() => void)[];
  listeners: Record<string, (event: { type: string; toolName: unknown }) => void>;
  queued: boolean;
  reads: number;
  emit(type: string, name: unknown): void;
}

declare global {
  interface Window {
    fixture: Fixture;
    ClarityWebMcp: { start: () => void };
  }
}

test.use({ channel: "chrome", launchOptions: { chromiumSandbox: true } });

async function setup(page: Page, queued: boolean = false): Promise<void> {
  await page.goto("about:blank");
  await page.evaluate(initiallyQueued => {
    const fixture: Fixture = window.fixture = {
      records: [], stops: [], listeners: {}, queued: initiallyQueued, reads: 0,
      emit(type: string, name: unknown): void {
        fixture.listeners[type]?.({ type, toolName: name });
      },
    };
    Object.defineProperty(window, "clarity", {
      value(command: string, argument: Token[] | ((...args: unknown[]) => void)):
        number | ((...args: unknown[]) => void) | undefined {
        if (fixture.queued) { return undefined; }
        if (command === "time") { return 250; }
        if (command === "register" && typeof argument === "function") {
          fixture.stops.push(argument);
          return undefined;
        }
        if (command === "measure" && typeof argument === "function") { return argument; }
        if (command === "queue" && Array.isArray(argument)) {
          fixture.records.push(JSON.parse(JSON.stringify(argument)));
          return undefined;
        }
        throw new Error(`Unsupported fixture Clarity command: ${command}`);
      },
    });
    const context = {
      ontoolactivated: null,
      ontoolcancel: null,
      addEventListener(type: string, listener: Fixture["listeners"][string]): void {
        fixture.listeners[type] = listener;
      },
      removeEventListener(type: string, listener: Fixture["listeners"][string]): void {
        if (fixture.listeners[type] === listener) { delete fixture.listeners[type]; }
      },
      get getTools(): never { fixture.reads++; throw new Error("Unexpected discovery"); },
    };
    Object.defineProperty(document, "modelContext", { value: context });
  }, queued);
  await page.addScriptTag({ content: source });
}

let browserOutput: string[];
test.beforeEach(({ page }) => {
  browserOutput = [];
  page.on("console", message => browserOutput.push(message.text()));
  page.on("pageerror", error => browserOutput.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(browserOutput).toEqual([]);
  expect(await page.evaluate(() => window.fixture.reads)).toBe(0);
});

test("encodes usage, caps collection and restarts", async ({ page }) => {
  expect(gzipSync(source).length).toBeLessThanOrEqual(1024);
  await setup(page);
  const result = await page.evaluate(() => {
    const f = window.fixture;
    f.emit("toolactivated", "add_to_cart");
    f.emit("toolcancel", "custom_tool");
    f.emit("toolactivated", "");
    for (let i = 0; i < 98; i++) { f.emit("toolactivated", "get_cart"); }
    const listenersAfterCap = Object.keys(f.listeners);
    f.stops.splice(0).forEach(stop => stop());
    window.ClarityWebMcp.start();
    f.emit("toolactivated", "after_restart");
    return { records: f.records, listenersAfterCap, stops: f.stops.length };
  });
  expect(result.records).toHaveLength(102);
  expect(result.records[0]).toEqual([250, 54, 1, 1]);
  expect(result.records[1]).toEqual([250, 54, 2, "custom_tool"]);
  expect(result.records.at(-2)).toEqual([250, 54, 3]);
  expect(result.records.at(-1)).toEqual([250, 54, 1, "after_restart"]);
  expect(result.listenersAfterCap).toEqual([]);
  expect(result.stops).toBe(1);
});

test("queued startup remains retryable", async ({ page }) => {
  await setup(page, true);
  expect(await page.evaluate(() => ({
    marked: !!(window as any).__clarityWebMcp,
    stops: window.fixture.stops.length,
  }))).toEqual({ marked: false, stops: 0 });

  const result = await page.evaluate(() => {
    window.fixture.queued = false;
    window.ClarityWebMcp.start();
    window.fixture.emit("toolactivated", "after_retry");
    return { records: window.fixture.records, stops: window.fixture.stops.length };
  });
  expect(result).toEqual({ records: [[250, 54, 1, "after_retry"]], stops: 1 });
});
