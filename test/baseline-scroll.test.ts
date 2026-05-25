import { test, expect } from "@playwright/test";
import { decode } from "clarity-decode";
import { readFileSync } from "fs";
import { resolve } from "path";
import { pathToFileURL } from "url";
import type { Page } from "@playwright/test";
import type { Data } from "clarity-decode";

declare global {
    interface Window {
        clarity: (method: string, ...args: any[]) => void;
        payloads: string[];
    }
}

// Mirrors interaction.Setting.LookAhead (500ms) from @clarity-types/interaction.
// Tests must wait at least this long after debounced events (mousemove, resize)
// for clarity to process them. We add a margin for scheduling/task overhead.
const DEBOUNCE_WAIT = 500 * 2 + 100;

const SCROLL_HTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; height: 5000px; }
    #nested {
      width: 300px;
      height: 200px;
      overflow: auto;
      position: fixed;
      top: 10px;
      left: 10px;
    }
    #nested-content { height: 3000px; }
    #target {
      width: 200px;
      height: 200px;
      background: blue;
      position: fixed;
      top: 300px;
      left: 300px;
    }
  </style>
</head>
<body>
  <div id="nested"><div id="nested-content">scrollable content</div></div>
  <div id="target">click me</div>
</body>
</html>`;

async function setupPage(page: Page): Promise<void> {
    // Set a known viewport size for predictable document dimensions
    await page.setViewportSize({ width: 1024, height: 768 });

    // Use a file URL as base so clarity can initialize properly
    const htmlPath = resolve(__dirname, "./html/core.html");
    const htmlFileUrl = pathToFileURL(htmlPath).toString();
    await page.goto(htmlFileUrl);

    const clarityJs = readFileSync(
        resolve(__dirname, "../packages/clarity-js/build/clarity.min.js"), "utf8"
    );

    await page.setContent(SCROLL_HTML.replace("</body>", `
        <script>
          window.payloads = [];
          ${clarityJs};
          clarity("start", {
            "delay": 100,
            "projectId": "test",
            "upload": (payload) => { window.payloads.push(payload); }
          });
        </script>
        </body>
    `));
}

function getBaselines(decoded: Data.DecodedPayload[]): any[] {
    const baselines: any[] = [];
    for (const payload of decoded) {
        if (payload.baseline) {
            baselines.push(...payload.baseline);
        }
    }
    return baselines;
}

function getScrolls(decoded: Data.DecodedPayload[]): any[] {
    const scrolls: any[] = [];
    for (const payload of decoded) {
        if (payload.scroll) {
            scrolls.push(...payload.scroll);
        }
    }
    return scrolls;
}

test.describe("Baseline scroll filtering", () => {
    test("document scroll updates baseline scrollY", async ({ page }) => {
        await setupPage(page);
        await page.waitForTimeout(500);

        // Scroll the page down
        await page.evaluate(() => window.scrollTo(0, 500));
        await page.waitForTimeout(1000);

        // Trigger a payload flush by firing an event
        await page.evaluate(() => (window as any).clarity("event", "flush"));
        await page.waitForTimeout(500);
        await page.waitForFunction("payloads && payloads.length > 0");

        const payloads: string[] = await page.evaluate("payloads");
        const decoded = payloads.map(x => decode(x));
        const baselines = getBaselines(decoded);
        const scrolls = getScrolls(decoded);

        // There should be scroll events recorded
        expect(scrolls.length).toBeGreaterThan(0);

        // Baseline should reflect the document scroll position
        const lastBaseline = baselines[baselines.length - 1];
        expect(lastBaseline).toBeTruthy();
        expect(lastBaseline.data.scrollY).toBe(500);
    });

    test("nested element scroll does not update baseline scrollY", async ({ page }) => {
        await setupPage(page);
        await page.waitForTimeout(500);

        // First scroll the document to a known position
        await page.evaluate(() => window.scrollTo(0, 200));
        await page.waitForTimeout(500);

        // Clear payloads so we capture fresh data
        await page.evaluate(() => { window.payloads = []; });

        // Scroll only the nested element
        await page.evaluate(() => {
            const nested = document.getElementById("nested");
            nested.scrollTop = 400;
            // Dispatch a scroll event to ensure clarity picks it up
            nested.dispatchEvent(new UIEvent("scroll", { bubbles: true }));
        });
        await page.waitForTimeout(1000);

        // Trigger flush
        await page.evaluate(() => (window as any).clarity("event", "flush"));
        await page.waitForTimeout(500);
        await page.waitForFunction("payloads && payloads.length > 0");

        const payloads: string[] = await page.evaluate("payloads");
        const decoded = payloads.map(x => decode(x));
        const baselines = getBaselines(decoded);

        expect(baselines.length).toBeGreaterThan(0);
        const lastBaseline = baselines[baselines.length - 1];
        expect(lastBaseline.data.scrollY).toBe(200);
    });

    test("nested scroll followed by document scroll updates baseline to document position", async ({ page }) => {
        await setupPage(page);
        await page.waitForTimeout(500);

        // Scroll nested element first
        await page.evaluate(() => {
            const nested = document.getElementById("nested");
            nested.scrollTop = 600;
            nested.dispatchEvent(new UIEvent("scroll", { bubbles: true }));
        });
        await page.waitForTimeout(300);

        // Then scroll the document
        await page.evaluate(() => window.scrollTo(0, 350));
        await page.waitForTimeout(1000);

        await page.evaluate(() => (window as any).clarity("event", "flush"));
        await page.waitForTimeout(500);
        await page.waitForFunction("payloads && payloads.length > 0");

        const payloads: string[] = await page.evaluate("payloads");
        const decoded = payloads.map(x => decode(x));
        const baselines = getBaselines(decoded);

        const lastBaseline = baselines[baselines.length - 1];
        expect(lastBaseline).toBeTruthy();
        // Baseline should reflect the document scroll (350), not the nested scroll (600)
        expect(lastBaseline.data.scrollY).toBe(350);
    });
});

function getLastBaseline(decoded: Data.DecodedPayload[]): any {
    const baselines = getBaselines(decoded);
    return baselines[baselines.length - 1];
}

async function flushAndDecode(page: Page): Promise<Data.DecodedPayload[]> {
    await page.evaluate(() => (window as any).clarity("event", "flush"));
    await page.waitForTimeout(500);
    await page.waitForFunction("payloads && payloads.length > 0");
    const payloads: string[] = await page.evaluate("payloads");
    return payloads.map(x => decode(x));
}

test.describe("Baseline pointer tracking", () => {
    test("mousemove updates pointer and move fields", async ({ page }) => {
        await setupPage(page);
        await page.waitForTimeout(500);

        await page.mouse.move(150, 250);
        await page.waitForTimeout(DEBOUNCE_WAIT);

        const decoded = await flushAndDecode(page);
        const last = getLastBaseline(decoded);
        expect(last).toBeTruthy();
        expect(last.data.pointerX).toBe(150);
        expect(last.data.pointerY).toBe(250);
        expect(last.data.moveX).toBe(150);
        expect(last.data.moveY).toBe(250);
    });

    test("click populates down and up fields", async ({ page }) => {
        await setupPage(page);
        await page.waitForTimeout(500);

        await page.mouse.click(400, 400);
        await page.waitForTimeout(500);

        const decoded = await flushAndDecode(page);
        const last = getLastBaseline(decoded);
        expect(last).toBeTruthy();
        expect(last.data.downX).toBe(400);
        expect(last.data.downY).toBe(400);
        expect(last.data.upX).toBe(400);
        expect(last.data.upY).toBe(400);
    });

    test("successive moves update pointerPrev fields", async ({ page }) => {
        await setupPage(page);
        await page.waitForTimeout(500);

        await page.mouse.move(100, 100);
        await page.waitForTimeout(DEBOUNCE_WAIT);
        await page.mouse.move(200, 200);
        await page.waitForTimeout(DEBOUNCE_WAIT);

        const decoded = await flushAndDecode(page);
        const last = getLastBaseline(decoded);
        expect(last).toBeTruthy();
        expect(last.data.pointerX).toBe(200);
        expect(last.data.pointerY).toBe(200);
        expect(last.data.pointerPrevX).toBe(100);
        expect(last.data.pointerPrevY).toBe(100);
    });
});

test.describe("Baseline resize tracking", () => {
    test("viewport resize updates screenWidth and screenHeight", async ({ page }) => {
        await setupPage(page);
        await page.waitForTimeout(500);

        await page.setViewportSize({ width: 800, height: 600 });
        await page.waitForTimeout(DEBOUNCE_WAIT);

        const decoded = await flushAndDecode(page);
        const last = getLastBaseline(decoded);
        expect(last).toBeTruthy();
        expect(last.data.screenWidth).toBe(800);
        expect(last.data.screenHeight).toBe(600);
    });
});

test.describe("Baseline document dimensions", () => {
    test("baseline captures exact document dimensions from CSS", async ({ page }) => {
        await setupPage(page);
        await page.waitForTimeout(500);

        // Trigger some activity so baseline gets encoded
        await page.mouse.move(10, 10);
        await page.waitForTimeout(500);

        const decoded = await flushAndDecode(page);
        const last = getLastBaseline(decoded);
        expect(last).toBeTruthy();
        // body { height: 5000px }, viewport width 1024
        expect(last.data.docWidth).toBe(1024);
        expect(last.data.docHeight).toBe(5000);
    });

    test("changing body height updates docHeight to new value", async ({ page }) => {
        await setupPage(page);
        await page.waitForTimeout(500);

        // Clear payloads, change body height
        await page.evaluate(() => {
            window.payloads = [];
            document.body.style.height = "10000px";
        });
        await page.waitForTimeout(500);

        // Trigger activity so baseline encodes again
        await page.mouse.move(20, 20);
        await page.waitForTimeout(500);

        const decoded = await flushAndDecode(page);
        const last = getLastBaseline(decoded);
        expect(last).toBeTruthy();
        expect(last.data.docHeight).toBe(10000);
    });
});

test.describe("Baseline visibility tracking", () => {
    test("hiding page sets visible to false", async ({ page }) => {
        await setupPage(page);
        await page.waitForTimeout(500);

        // Override visibilityState and dispatch the event
        await page.evaluate(() => {
            Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true, configurable: true });
            document.dispatchEvent(new Event("visibilitychange"));
        });
        await page.waitForTimeout(DEBOUNCE_WAIT);

        const decoded = await flushAndDecode(page);
        const last = getLastBaseline(decoded);
        expect(last).toBeTruthy();
        // BooleanFlag.False = 0
        expect(last.data.visible).toBe(0);
    });

    test("restoring visibility sets visible to true", async ({ page }) => {
        await setupPage(page);
        await page.waitForTimeout(500);

        // Hide then show
        await page.evaluate(() => {
            Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true, configurable: true });
            document.dispatchEvent(new Event("visibilitychange"));
        });
        await page.waitForTimeout(DEBOUNCE_WAIT);

        await page.evaluate(() => {
            window.payloads = [];
            Object.defineProperty(document, "visibilityState", { value: "visible", writable: true, configurable: true });
            document.dispatchEvent(new Event("visibilitychange"));
        });
        await page.waitForTimeout(DEBOUNCE_WAIT);

        const decoded = await flushAndDecode(page);
        const last = getLastBaseline(decoded);
        expect(last).toBeTruthy();
        // BooleanFlag.True = 1
        expect(last.data.visible).toBe(1);
    });
});
