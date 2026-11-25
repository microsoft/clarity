import { expect, test } from "@playwright/test";
import { join } from "path";
import type { Config } from "../types/core";
import type { Payload } from "../types/data";

const LanguagesDimension = 41;

test("captures the first five navigator languages in order", async ({ page }): Promise<void> => {
    await page.route("https://clarity.test/", route => route.fulfill({ body: "<html></html>" }));
    await page.goto("https://clarity.test/");
    await page.evaluate(() => Object.defineProperty(navigator, "languages", {
        value: ["en-US", "en", "fr", "de", "ja", "es"],
        configurable: true
    }));
    await page.addScriptTag({ path: join(__dirname, "../build/clarity.min.js") });

    const languages = await page.evaluate((dimension: number) => new Promise<string[]>((resolve) => {
        const clarity: unknown = Reflect.get(window, "clarity");
        if (typeof clarity !== "function") { throw new Error("Clarity browser API was not loaded."); }
        const config: Config = {
            projectId: "languages-test",
            track: false,
            lean: true,
            delay: 100,
            upload: (payload: string): void => {
                const event = (JSON.parse(payload) as Payload).a.find(entry => entry[1] === 1);
                const index = event?.indexOf(dimension);
                if (index >= 0) { resolve(event[index + 1] as string[]); }
            }
        };
        clarity("start", config);
    }), LanguagesDimension);

    expect(languages).toEqual(["en-US", "en", "fr", "de", "ja"]);
});
