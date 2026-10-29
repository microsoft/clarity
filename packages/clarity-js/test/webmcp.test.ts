import { test, expect, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import type { Host, Token } from "../src/dynamic/webmcp/common";

const source = readFileSync(resolve(__dirname, "../build/dynamic/clarity.webmcp.js"), "utf8");
type Failure = "" | "queue" | "time" | "attach" | "controller-missing" | "controller-throws" | "register";
interface Fixture {
  records: Token[][];
  stops: (() => void)[];
  listeners: Record<string, (event: { type: string; toolName: unknown; isTrusted: boolean }) => void>;
  targets: Record<string, string>;
  failure: Failure;
  reads: number;
  emit(type: string, name: unknown, trusted?: boolean, target?: string): void;
}
declare global {
  interface Window {
    fixture: Fixture;
    ClarityWebMcp: { start: () => void };
  }
}

test.use({ channel: "chrome", launchOptions: { chromiumSandbox: true } });

async function setup(
  page: Page,
  contextVariant: "absent" | "current" | "legacy" | "mixed" = "current",
  initialFailure: Failure = ""
): Promise<void> {
  await page.goto("about:blank");
  await page.evaluate(({ variant, failure }) => {
    const fixture: Fixture = window.fixture = {
      records: [], stops: [], listeners: {}, targets: {}, failure, reads: 0,
      emit(type: string, name: unknown, trusted: boolean = true, target?: string): void {
        if (!target || fixture.targets[type] === target) fixture.listeners[type]?.({ type, toolName: name, isTrusted: trusted });
      },
    };
    if (failure === "controller-missing" || failure === "controller-throws") {
      Object.defineProperty(window, "AbortController", {
        value: failure === "controller-missing" ? undefined : class {
          constructor() { throw new Error("Fixture controller failure"); }
        },
      });
    }
    const attach = (target: string) => (type: string, listener: Fixture["listeners"][string], options: AddEventListenerOptions) => {
      if (fixture.failure === "attach" && type === "toolcancel") throw new Error("Fixture attachment failure");
      fixture.listeners[type] = listener;
      fixture.targets[type] = target;
      options.signal?.addEventListener("abort", () => { delete fixture.listeners[type]; delete fixture.targets[type]; }, { once: true });
    };
    const addWindow = window.addEventListener;
    Object.defineProperty(window, "addEventListener", {
      value(type: string, listener: Fixture["listeners"][string], options: AddEventListenerOptions): void {
        if (type === "toolactivated" || type === "toolcancel") attach("window")(type, listener, options);
        else Reflect.apply(addWindow, window, [type, listener, options]);
      },
    });
    Object.defineProperty(window, "clarity", {
      value(
        command: string,
        argument: Token[] | ((...args: unknown[]) => void)
      ): number | ((...args: unknown[]) => void) | undefined {
        if (command === "time") return fixture.failure === "time" ? undefined : 250;
        if (command === "register" && typeof argument === "function") {
          if (fixture.failure === "register") throw new Error("Fixture registration failure");
          fixture.stops.push(argument);
          return undefined;
        }
        if (command === "measure" && typeof argument === "function") return argument;
        if (command === "queue" && Array.isArray(argument)) {
          if (fixture.failure === "queue") throw new Error("Fixture queue failure");
          fixture.records.push(JSON.parse(JSON.stringify(argument)));
          return undefined;
        }
        throw new Error(`Unsupported fixture command: ${command}`);
      },
    });
    const context = {
      addEventListener: attach("document.modelContext"),
      ...(variant !== "legacy" ? { ontoolactivated: null } : {}),
      ...(variant === "current" ? { ontoolcancel: null } : {}),
      get getTools(): never { fixture.reads++; throw new Error("Unexpected discovery"); },
    };
    Object.defineProperty(document, "modelContext", { value: variant === "absent" ? undefined : context });
  }, { variant: contextVariant, failure: initialFailure });
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

test("contract, compatibility targets and lifecycle", async ({ page }) => {
  expect(gzipSync(source).length).toBeLessThanOrEqual(1024);
  await setup(page, "absent");
  expect(await page.evaluate(() => window.fixture.records)).toEqual([[250, 205, 1, 1]]);
  expect(await page.evaluate(() => Object.keys(window.fixture.listeners))).toEqual([]);
  for (const variant of ["current", "legacy", "mixed"] as const) {
    await test.step(variant, async () => {
      await setup(page, variant);
      await page.addScriptTag({ content: source });
      const result = await page.evaluate(() => {
        const f = window.fixture;
        const targets = { ...f.targets };
        for (let call = 0; call < 2; call++) {
          for (const target of ["window", "document.modelContext"]) f.emit("toolactivated", "Cart.Checkout", true, target);
        }
        for (const target of ["window", "document.modelContext"]) f.emit("toolcancel", "Cart.Checkout", true, target);
        f.emit("toolactivated", "synthetic", false);
        f.stops.splice(0).forEach(stop => stop());
        f.emit("toolactivated", "after_stop");
        const detached = Object.keys(f.listeners);
        window.ClarityWebMcp.start();
        window.ClarityWebMcp.start();
        f.emit("toolactivated", "after_restart");
        return { records: f.records, targets, detached, stops: f.stops.length, reads: f.reads };
      });
      expect(result).toEqual({
        records: [[250, 205, 1, 2], [250, 205, 2, "Cart.Checkout"], [250, 205, 2, "Cart.Checkout"],
          [250, 205, 3, "Cart.Checkout"], [250, 205, 1, 2], [250, 205, 2, "after_restart"]],
        targets: { toolactivated: variant === "legacy" ? "window" : "document.modelContext",
          toolcancel: variant === "current" ? "document.modelContext" : "window" },
        detached: [], stops: 1, reads: 0,
      });
    });
  }
});

test("known names use stable IDs and unknown names remain exact", async ({ page }) => {
  await setup(page);
  const tools = [
    ["add_to_cart", 1], ["browse_store", 2], ["cancel_cart", 3], ["get_cart", 4],
    ["get_product", 5], ["get_ucp_profile", 6], ["manage_orders", 7], ["proceed_to_checkout", 8],
    ["search_catalog", 9], ["search_shop_policies_and_faqs", 10], ["show_variant", 11], ["update_cart_lines", 12],
  ] as const;
  const unknownNames = [
    "custom_tool", "1", "ADD_TO_CART", "add-to-cart", "shop.add_to_cart",
    "constructor", "toString", "__proto__", "inherited_tool",
  ];
  const records = await page.evaluate(({ names, unknownNames: otherNames }) => {
    const f = window.fixture;
    Object.defineProperty(Object.prototype, "inherited_tool", { value: 9, configurable: true });
    try {
      for (const name of [...names, ...otherNames]) {
        f.emit("toolactivated", name);
        f.emit("toolcancel", name);
      }
      f.emit("toolactivated", "get_cart", false);
      return f.records;
    } finally {
      delete (Object.prototype as Record<string, unknown>).inherited_tool;
    }
  }, { names: tools.map(([name]) => name), unknownNames });
  expect(records).toEqual([
    [250, 205, 1, 2],
    ...tools.flatMap(([, id]) => [[250, 205, 2, id], [250, 205, 3, id]]),
    ...unknownNames.flatMap(name => [[250, 205, 2, name], [250, 205, 3, name]]),
  ]);
});

test("name boundaries and shared usage cap", async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const f = window.fixture;
    f.emit("toolactivated", "x".repeat(128));
    f.emit("toolactivated", 'fixture " escaped');
    for (let i = 0; i < 110; i++) f.emit(i % 2 ? "toolcancel" : "toolactivated", i % 3 ? `tool_${i}` : "get_cart");
  });
  await page.addScriptTag({ content: source });
  const capped = await page.evaluate(() => {
    const f = window.fixture;
    f.emit("toolactivated", "after_cap");
    return { records: f.records, listeners: Object.keys(f.listeners), stops: f.stops.length };
  });
  expect(capped.records).toHaveLength(102);
  expect(capped.records[1]).toEqual([250, 205, 2, "x".repeat(128)]);
  expect(capped.records[2]).toEqual([250, 205, 2, 'fixture " escaped']);
  expect(capped.records[3]).toEqual([250, 205, 2, 4]);
  expect(capped.records[4]).toEqual([250, 205, 3, "tool_1"]);
  expect(capped.records.at(-1)).toEqual([250, 205, 4]);
  expect(capped.listeners).toEqual([]);
  expect(capped.stops).toBe(1);
  const restarted = await page.evaluate(() => {
    const f = window.fixture;
    f.stops.splice(0).forEach(stop => stop());
    window.ClarityWebMcp.start();
    f.emit("toolactivated", "after_restart");
    return { records: f.records.slice(102), stops: f.stops.length };
  });
  expect(restarted).toEqual({ records: [[250, 205, 1, 2], [250, 205, 2, "after_restart"]], stops: 1 });
  for (const [type, name] of [
    ["toolactivated", undefined], ["toolactivated", null], ["toolactivated", 42],
    ["toolactivated", ""], ["toolactivated", "x".repeat(129)], ["toolcancel", ""],
  ] as const) {
    await setup(page);
    const result = await page.evaluate(({ type: eventType, name: toolName }) => {
      const f = window.fixture;
      f.emit(eventType, toolName);
      f.emit("toolactivated", "after_invalid");
      return { records: f.records, listeners: Object.keys(f.listeners) };
    }, { type, name });
    expect(result, `${type}: ${String(name)}`).toEqual({ records: [[250, 205, 1, 2]], listeners: [] });
  }
});

test("startup and queue failures stop silently", async ({ page }) => {
  for (const failure of ["controller-missing", "controller-throws", "register"] as const) {
    await setup(page, "current", failure);
    const result = await page.evaluate(() => ({
      records: window.fixture.records,
      listeners: Object.keys(window.fixture.listeners),
      stops: window.fixture.stops.length,
      marked: !!(window as Host).__clarityWebMcp,
    }));
    expect(result, failure).toEqual({ records: [], listeners: [], stops: 0, marked: false });
    if (failure === "register") {
      const retry = await page.evaluate(() => {
        const f = window.fixture;
        f.failure = "";
        window.ClarityWebMcp.start();
        f.emit("toolactivated", "after_retry");
        return { records: f.records, stops: f.stops.length };
      });
      expect(retry).toEqual({ records: [[250, 205, 1, 2], [250, 205, 2, "after_retry"]], stops: 1 });
    }
  }
  for (const failure of ["queue", "time", "attach"] as const) {
    await setup(page, "current", failure);
    const result = await page.evaluate(() => {
      const f = window.fixture;
      f.failure = "";
      window.ClarityWebMcp.start();
      f.emit("toolactivated", "after_failure");
      return { records: f.records, listeners: Object.keys(f.listeners), stops: f.stops.length,
        marked: !!(window as Host).__clarityWebMcp };
    });
    expect(result, failure).toEqual({ records: [], listeners: [], stops: 1, marked: true });
    const restarted = await page.evaluate(() => {
      const f = window.fixture;
      f.stops.splice(0).forEach(stop => stop());
      window.ClarityWebMcp.start();
      f.emit("toolactivated", "after_restart");
      return f.records;
    });
    expect(restarted, failure).toEqual([[250, 205, 1, 2], [250, 205, 2, "after_restart"]]);
  }
  await setup(page);
  const queueFailure = await page.evaluate(() => {
    const f = window.fixture;
    f.failure = "queue";
    f.emit("toolactivated", "checkout");
    f.failure = "";
    window.ClarityWebMcp.start();
    f.emit("toolactivated", "after_failure");
    return { records: f.records, listeners: Object.keys(f.listeners), stops: f.stops.length };
  });
  expect(queueFailure).toEqual({ records: [[250, 205, 1, 2]], listeners: [], stops: 1 });
});
