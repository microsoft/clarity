import { test, expect } from "@playwright/test";
import { decode } from "clarity-decode";
import { markup } from "./helper";

// Wire-protocol IDs mirrored from packages/clarity-js/types/data.d.ts.
// clarity-decode declares Data.Dimension / Data.Metric as const enums (types-only),
// so they have no runtime representation we can import here.
const Dimension = { Platform: 22, PlatformVersion: 23, Brand: 24, Model: 25 } as const;
const Metric = { Mobile: 27 } as const;

async function setupAndCollect(page: import("@playwright/test").Page) {
    // Capture navigator.userAgentData ground truth before clarity loads.
    await page.addInitScript(() => {
        (window as any).uachData = null;
        const ua = (navigator as any).userAgentData;
        if (ua && ua.getHighEntropyValues) {
            (window as any).uachData = {
                brands: ua.brands.map((b: any) => ({ brand: b.brand, version: b.version })),
                platform: ua.platform,
                mobile: ua.mobile,
            };
            ua.getHighEntropyValues(["model", "platformVersion"]).then((hv: any) => {
                (window as any).uachData.platformVersion = hv.platformVersion;
                (window as any).uachData.model = hv.model;
            });
        }
    });

    const encoded = await markup(page, "core.html");
    await page.waitForFunction("window.uachData !== null && window.uachData.platformVersion !== undefined");

    const uachData = await page.evaluate("window.uachData") as {
        brands: { brand: string; version: string }[];
        platform: string;
        platformVersion: string;
        model: string;
        mobile: boolean;
    };

    const decoded = encoded.map(x => decode(x));

    const clarityBrands: string[] = [];
    let clarityPlatform: string | undefined;
    let clarityPlatformVersion: string | undefined;
    let clarityModel: string | undefined;
    let clarityMobile: number | undefined;
    for (const payload of decoded) {
        if (payload.dimension) {
            for (const event of payload.dimension) {
                if (event.data) {
                    if (event.data[Dimension.Brand]) { clarityBrands.push(...event.data[Dimension.Brand]); }
                    if (event.data[Dimension.Platform]) { clarityPlatform = event.data[Dimension.Platform][0]; }
                    if (event.data[Dimension.PlatformVersion]) { clarityPlatformVersion = event.data[Dimension.PlatformVersion][0]; }
                    if (event.data[Dimension.Model]) { clarityModel = event.data[Dimension.Model][0]; }
                }
            }
        }
        if (payload.metric) {
            for (const event of payload.metric) {
                if (event.data && event.data[Metric.Mobile] !== undefined) { clarityMobile = event.data[Metric.Mobile]; }
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
        if (uachData.platformVersion) {
            expect(clarityPlatformVersion).toBe(uachData.platformVersion);
        } else {
            // Headless/Linux browsers return empty platformVersion; dimension.log skips empty strings
            expect(clarityPlatformVersion).toBeUndefined();
        }
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
