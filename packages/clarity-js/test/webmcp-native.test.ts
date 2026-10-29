import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";

type ModelContext = EventTarget & {
  registerTool(tool: {
    name: string; description: string; inputSchema: object;
    execute: (input: object, client: { signal: AbortSignal }) => Promise<{ content: { type: string; text: string }[] }>;
  }): void;
  getTools(): Promise<{ name: string }[]>;
  executeTool(tool: { name: string }, input: object, options?: { signal: AbortSignal }): Promise<unknown>;
};

test.use({ channel: "chrome", launchOptions: { chromiumSandbox: true, args: ["--enable-blink-features=WebMCP"] } });

test("current Chrome queues trusted activation and cancellation through the actual observer", async ({ page, browser }, info) => {
  const output: string[] = [];
  page.on("console", message => output.push(message.text()));
  page.on("pageerror", error => output.push(error.message));
  await page.route("https://webmcp.test/fixture", route => route.fulfill({
    contentType: "text/html", body: "<!doctype html><title>Native observer fixture</title>",
  }));
  await page.goto("https://webmcp.test/fixture");
  const result = await page.evaluate(async source => {
    const context = (document as Document & { modelContext: ModelContext }).modelContext;
    if (typeof context?.registerTool !== "function" || typeof context.getTools !== "function" ||
        typeof context.executeTool !== "function") throw new Error("Native WebMCP APIs are unavailable");
    const records: (number | string)[][] = [];
    const diagnostics: [string, unknown, boolean, boolean][] = [];
    const stops: (() => void)[] = [];
    Object.defineProperty(window, "clarity", { value: (command: string, argument: (number | string)[] | ((...args: unknown[]) => void)) => {
      if (command === "time") return Math.round(performance.now());
      if (command === "register" && typeof argument === "function") { stops.push(argument); return undefined; }
      if (command === "measure" && typeof argument === "function") return argument;
      if (command === "queue" && Array.isArray(argument)) { records.push([...argument]); return undefined; }
      throw new Error(`Unsupported fixture Clarity command: ${command}`);
    } });
    for (const type of ["toolactivated", "toolcancel"]) context.addEventListener(type, event => {
      diagnostics.push([event.type, "toolName" in event ? event.toolName : null, event.isTrusted, event.target === context]);
    });
    for (const name of ["complete_tool", "cancel_tool", "add_to_cart", "search_catalog"]) context.registerTool({
      name, description: "Observer test fixture", inputSchema: { type: "object", properties: {} },
      execute: async (_, client) => name === "complete_tool" || name === "add_to_cart" ? { content: [{ type: "text", text: "ok" }] }
        : new Promise(resolve => client.signal.addEventListener("abort",
          () => resolve({ content: [{ type: "text", text: "cancelled" }] }), { once: true })),
    });
    const tools = await context.getTools();
    let discoveryReads = 0;
    Object.defineProperty(context, "getTools", {
      get(): never { discoveryReads++; throw new Error("Usage-only must not access discovery"); },
    });
    const script = document.createElement("script");
    script.textContent = source;
    document.head.appendChild(script);
    const complete = tools.find(tool => tool.name === "complete_tool");
    const cancel = tools.find(tool => tool.name === "cancel_tool");
    const knownComplete = tools.find(tool => tool.name === "add_to_cart");
    const knownCancel = tools.find(tool => tool.name === "search_catalog");
    if (!complete || !cancel || !knownComplete || !knownCancel) throw new Error("Native tool registration failed");
    await context.executeTool(complete, {});
    await context.executeTool(knownComplete, {});
    const cancellations: string[] = [];
    for (const tool of [cancel, knownCancel]) {
      const controller = new AbortController();
      const activated = new Promise<void>(resolve => context.addEventListener("toolactivated", () => resolve(), { once: true }));
      const cancelled = new Promise<void>(resolve => context.addEventListener("toolcancel", () => resolve(), { once: true }));
      const outcome = context.executeTool(tool, {}, { signal: controller.signal }).then(
        () => "resolved", (error: Error) => error.name,
      );
      await activated;
      controller.abort();
      cancellations.push(await outcome);
      await cancelled;
    }
    stops.forEach(stop => stop());
    return { records, diagnostics, cancellations, discoveryReads };
  }, readFileSync(resolvePath(__dirname, "../build/dynamic/clarity.webmcp.js"), "utf8"));
  expect(result.cancellations).toEqual(["AbortError", "AbortError"]);
  expect(result.records.map(tokens => tokens.slice(1))).toEqual([
    [205, 1, 2], [205, 2, "complete_tool"], [205, 2, 1],
    [205, 2, "cancel_tool"], [205, 3, "cancel_tool"], [205, 2, 9], [205, 3, 9],
  ]);
  expect(result.diagnostics).toEqual([
    ["toolactivated", "complete_tool", true, true],
    ["toolactivated", "add_to_cart", true, true],
    ["toolactivated", "cancel_tool", true, true],
    ["toolcancel", "cancel_tool", true, true],
    ["toolactivated", "search_catalog", true, true],
    ["toolcancel", "search_catalog", true, true],
  ]);
  expect(result.discoveryReads).toBe(0);
  expect(output).toEqual([]);
  const evidence = info.outputPath("native-capture.json");
  await writeFile(evidence, JSON.stringify({ browser: browser.version(), ...result }, null, 2));
  await info.attach("actual-native-browser-queue-not-agent-integration", { path: evidence, contentType: "application/json" });
});
