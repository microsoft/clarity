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
  </style>
</head>
<body>
  <div id="nested"><div id="nested-content">scrollable content</div></div>
</body>
</html>`;

async function setupPage(page: Page): Promise<void> {
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

        // If baseline was captured, scroll should still reflect the document position (200), not the nested (400)
        if (baselines.length > 0) {
            const lastBaseline = baselines[baselines.length - 1];
            expect(lastBaseline.data.scrollY).toBe(200);
        }
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
