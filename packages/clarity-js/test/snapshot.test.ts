import { expect, test } from "@playwright/test";
import type { Route } from "@playwright/test";
import { join } from "path";
import type { Config } from "../types/core";
import type { Event as ClarityEvent, Payload } from "../types/data";

const snapshotEvent: ClarityEvent.Snapshot = 43;
const discoverEvent: ClarityEvent.Discover = 5;
const clickEvent: ClarityEvent.Click = 9;
const origin = "https://clarity.test/";
const collect = `${origin}collect`;
const html = "<!doctype html><html><head></head><body><button id='snapshot-button'>Example</button></body></html>";
const builds = [
    { name: "normal", file: "clarity.min.js", snapshot: false, recording: true, clicks: true, conversions: false },
    { name: "extended", file: "clarity.extended.js", snapshot: false, recording: true, clicks: true, conversions: false },
    { name: "performance", file: "clarity.performance.js", snapshot: false, recording: false, clicks: false, conversions: false },
    { name: "Insights", file: "clarity.insight.js", snapshot: true, recording: false, clicks: true, conversions: false },
    { name: "Insights conversions", file: "clarity.insight.js", snapshot: true, recording: false, clicks: true, conversions: true }
];

test.describe("build-specific snapshot responses", () => {
    for (const build of builds) {
        test(`${build.name} preserves capture after a SNAPSHOT response`, async ({ page }) => {
            const payloads: Payload[] = [];
            const errors: string[] = [];
            const unexpectedRequests: string[] = [];
            page.on("pageerror", (error: Error) => errors.push(error.message));
            await page.route("**/*", async (route: Route): Promise<void> => {
                const request = route.request();
                if (request.url() === origin) {
                    await route.fulfill({ status: 200, contentType: "text/html", body: html });
                } else if (request.url() === collect) {
                    payloads.push(JSON.parse(request.postData()));
                    await route.fulfill({
                        status: payloads.length === 1 ? 200 : 204,
                        contentType: "text/plain",
                        body: payloads.length === 1 ? "SNAPSHOT\nACTION snapshot-complete" : ""
                    });
                } else {
                    unexpectedRequests.push(request.url());
                    await route.abort();
                }
            });
            await page.goto(origin);
            await page.evaluate(() => {
                // Keep fixture uploads readable instead of gzip-compressed.
                Object.defineProperty(window, "CompressionStream", { value: undefined, configurable: true });
            });
            await page.addScriptTag({ path: join(__dirname, "../build", build.file) });
            await page.evaluate(({ upload, conversions }: { upload: string; conversions: boolean }) => {
                const clarity: unknown = Reflect.get(window, "clarity");
                if (typeof clarity !== "function") { throw new Error("Clarity browser API was not loaded."); }
                const config: Config = {
                    projectId: "snapshot-test",
                    track: false,
                    lean: true,
                    delay: 100,
                    conversions,
                    upload,
                    action: (value: string): void => document.documentElement.setAttribute("data-snapshot-response", value)
                };
                clarity("start", config);
            }, { upload: collect, conversions: build.conversions });

            await expect(page.locator("html")).toHaveAttribute("data-snapshot-response", "snapshot-complete");
            expect(payloads[0].p || []).toHaveLength(0);
            if (build.clicks) {
                await page.click("#snapshot-button");
                await expect.poll(() => payloads.some(payload => payload.a.some(event => event[1] === clickEvent))).toBe(true);
            }
            await page.evaluate(() => {
                const clarity: unknown = Reflect.get(window, "clarity");
                if (typeof clarity !== "function") { throw new Error("Clarity browser API was not loaded."); }
                clarity("stop");
            });
            await expect.poll(() => payloads.some(payload => payload.e[9] === 1)).toBe(true);

            const events = payloads.reduce<Payload["a"]>((all, payload) => all.concat(payload.a || [], payload.p || []), []);
            const snapshots = events.filter(event => event[1] === snapshotEvent);
            expect(snapshots.length).toBe(build.snapshot ? 1 : 0);
            if (build.snapshot) {
                expect(JSON.stringify(snapshots[0])).toContain("id=snapshot-button");
            }
            expect(events.some(event => event[1] === discoverEvent)).toBe(build.recording);
            expect(events.some(event => event[1] === clickEvent)).toBe(build.clicks);
            expect(errors).toEqual([]);
            expect(unexpectedRequests).toEqual([]);
        });
    }
});
