import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { join } from "path";
import type { Config } from "../types/core";
import type { DimensionData, Payload } from "../types/data";

const LanguageDimension = 9;
const PageLanguageDimension = 16;
const LanguagesDimension = 41;

const scenarios: { name: string; languages: string[] | undefined; expected: string[] | undefined }[] = [
    { name: "short list", languages: ["en-US", "fr"], expected: ["en-US", "fr"] },
    { name: "five entries", languages: ["en-US", "en", "fr", "de", "ja"], expected: ["en-US", "en", "fr", "de", "ja"] },
    { name: "truncated list", languages: ["en-US", "en", "fr", "de", "ja", "es"], expected: ["en-US", "en", "fr", "de", "ja"] },
    { name: "empty list", languages: [], expected: undefined },
    { name: "unavailable API", languages: undefined, expected: undefined },
    { name: "cap before deduplication", languages: ["en-US", "en-US", "fr", "de", "ja", "es"], expected: ["en-US", "fr", "de", "ja"] }
];

test.describe("navigator languages metadata", () => {
    for (const scenario of scenarios) {
        test(scenario.name, async ({ page }: { page: Page }): Promise<void> => {
            const errors: string[] = [];
            page.on("pageerror", (error: Error) => errors.push(error.message));
            await page.route("**/*", async (route: Route): Promise<void> => {
                if (route.request().url() === "https://clarity.test/") {
                    await route.fulfill({ contentType: "text/html", body: "<!doctype html><html lang='it'><body></body></html>" });
                } else {
                    await route.abort();
                }
            });
            await page.goto("https://clarity.test/");
            await page.evaluate((languages: string[] | undefined): void => {
                Object.defineProperty(navigator, "language", { value: "en-US", configurable: true });
                Object.defineProperty(navigator, "languages", {
                    value: languages ? Object.freeze(languages) : undefined,
                    configurable: true
                });
            }, scenario.languages);
            await page.addScriptTag({ path: join(__dirname, "../build/clarity.min.js") });

            const dimensions = await page.evaluate(() => new Promise<DimensionData>((resolve) => {
                const clarity: unknown = Reflect.get(window, "clarity");
                if (typeof clarity !== "function") { throw new Error("Clarity browser API was not loaded."); }
                const config: Config = {
                    projectId: "languages-test",
                    track: false,
                    lean: true,
                    delay: 100,
                    upload: (payload: string): void => {
                        const data: Payload = JSON.parse(payload);
                        for (const event of data.a) {
                            if (event[1] === 1) {
                                const values: DimensionData = {};
                                for (let i = 2; i < event.length; i += 2) {
                                    values[event[i] as number] = event[i + 1] as string[];
                                }
                                resolve(values);
                            }
                        }
                    }
                };
                clarity("start", config);
            }));

            expect(dimensions[LanguagesDimension]).toEqual(scenario.expected);
            expect(dimensions[LanguageDimension]).toEqual(["en-US"]);
            expect(dimensions[PageLanguageDimension]).toEqual(["it"]);
            expect(errors).toEqual([]);
        });
    }
});
