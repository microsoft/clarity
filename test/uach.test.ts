import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { pathToFileURL } from "url";
import { resolve } from "path";
import { decode } from "clarity-decode";

async function setupAndCollect(page: import("@playwright/test").Page) {
    const htmlPath = resolve(__dirname, "./html/core.html");
    const html = readFileSync(htmlPath, "utf8");
    await page.goto(pathToFileURL(htmlPath).toString());

    await page.setContent(html.replace("</body>", `
        <script>
          window.payloads = [];
          window.uachData = null;

          if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
            window.uachData = {
              brands: navigator.userAgentData.brands.map(function(b) {
                return { brand: b.brand, version: b.version };
              }),
              platform: navigator.userAgentData.platform,
              mobile: navigator.userAgentData.mobile
            };
            navigator.userAgentData.getHighEntropyValues(
              ["model", "platformVersion"]
            ).then(function(ua) {
              window.uachData.platformVersion = ua.platformVersion;
              window.uachData.model = ua.model;
            });
          }

          ${readFileSync(resolve(__dirname, "../packages/clarity-js/build/clarity.min.js"), "utf8")};
          clarity("start", {
            delay: 100,
            content: true,
            fraud: [],
            regions: [],
            mask: [],
            unmask: [],
            upload: function(payload) { window.payloads.push(payload); window.clarity("upgrade", "test"); },
            projectId: "test"
          });
        </script>
        </body>
    `));

    await page.hover("#two");
    await page.click("#child");
    await page.locator("#search").fill("");
    await page.locator("#search").type("query");
    await page.waitForFunction("payloads && payloads.length > 2");
    await page.waitForFunction("window.uachData !== null && window.uachData.platformVersion !== undefined");

    const uachData = await page.evaluate("window.uachData") as {
        brands: { brand: string; version: string }[];
        platform: string;
        platformVersion: string;
        model: string;
        mobile: boolean;
    };

    const encoded: string[] = await page.evaluate("payloads");
    const decoded = encoded.map(x => decode(x));

    // Dimension keys: Platform=22, PlatformVersion=23, Brand=24, Model=25
    // Metric keys: Mobile=27
    const clarityBrands: string[] = [];
    let clarityPlatform: string | undefined;
    let clarityPlatformVersion: string | undefined;
    let clarityModel: string | undefined;
    let clarityMobile: number | undefined;
    for (const payload of decoded) {
        if (payload.dimension) {
            for (const event of payload.dimension) {
                if (event.data) {
                    if (event.data[24]) { clarityBrands.push(...event.data[24]); }
                    if (event.data[22]) { clarityPlatform = event.data[22][0]; }
                    if (event.data[23]) { clarityPlatformVersion = event.data[23][0]; }
                    if (event.data[25]) { clarityModel = event.data[25][0]; }
                }
            }
        }
        if (payload.metric) {
            for (const event of payload.metric) {
                if (event.data && event.data[27] !== undefined) { clarityMobile = event.data[27]; }
            }
        }
    }

    return { uachData, clarityBrands, clarityPlatform, clarityPlatformVersion, clarityModel, clarityMobile };
}

test.describe("UA-CH userAgentData", () => {

    test("Brand dimension contains correct browser brand names", async ({ page }) => {
        const { uachData, clarityBrands } = await setupAndCollect(page);

        const realBrands = uachData.brands
            .filter(b => /^(Chromium|Google Chrome|Chrome)$/i.test(b.brand))
            .map(b => b.brand + "~" + b.version);

        expect(realBrands.length).toBeGreaterThan(0);
        expect(clarityBrands.length).toBeGreaterThan(0);

        for (const expected of realBrands) {
            expect(clarityBrands).toContain(expected);
        }

        for (const brand of clarityBrands) {
            expect(brand).not.toMatch(/^undefined~/);
        }
    });

    test("Brand dimension contains major-only versions, not full dotted versions", async ({ page }) => {
        const { clarityBrands } = await setupAndCollect(page);

        expect(clarityBrands.length).toBeGreaterThan(0);

        for (const brand of clarityBrands) {
            const version = brand.split("~")[1];
            expect(version).toBeDefined();
            expect(version).not.toContain(".");
        }
    });

    test("Platform matches UA-CH platform", async ({ page }) => {
        const { uachData, clarityPlatform } = await setupAndCollect(page);
        expect(clarityPlatform).toBe(uachData.platform);
    });

    test("PlatformVersion matches UA-CH platformVersion", async ({ page }) => {
        const { uachData, clarityPlatformVersion } = await setupAndCollect(page);
        expect(clarityPlatformVersion).toBe(uachData.platformVersion);
    });

    test("Model matches UA-CH model", async ({ page }) => {
        const { uachData, clarityModel } = await setupAndCollect(page);
        if (uachData.model) {
            expect(clarityModel).toBe(uachData.model);
        } else {
            // Desktop browsers return empty model; Clarity omits empty dimensions
            expect(clarityModel).toBeUndefined();
        }
    });

    test("Mobile metric matches UA-CH mobile", async ({ page }) => {
        const { uachData, clarityMobile } = await setupAndCollect(page);
        const expected = uachData.mobile ? 1 : 0;
        expect(clarityMobile).toBe(expected);
    });
});
