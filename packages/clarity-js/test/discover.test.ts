import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";
import { Config } from "../types/core";

const clarityJsPath = join(__dirname, "../build/clarity.min.js");

type DiscoveryWindow = typeof window & {
    clarity: (command: "start" | "stop", config?: Config) => void;
    discoveryErrors: string[];
};

test.describe("discovery cancellation", () => {
    test.beforeEach(async ({ page }) => {
        await page.route("**/*", (route) => route.abort());
        await page.setContent("<h1>Heading</h1><img id='masked' data-clarity-mask>");
        await page.evaluate((): void => {
            const capture = window as DiscoveryWindow;
            capture.discoveryErrors = [];
            const original = Promise.prototype.catch;
            // Observe scheduler-handled errors that do not become unhandled rejections.
            Object.defineProperty(Promise.prototype, "catch", {
                configurable: true,
                writable: true,
                value(this: Promise<unknown>, handler?: (reason: unknown) => unknown): Promise<unknown> {
                    return original.call(this, (error: unknown): unknown => {
                        capture.discoveryErrors.push(error instanceof Error ? error.message : String(error));
                        if (typeof handler === "function") { return handler(error); }
                        throw error;
                    });
                }
            });
        });
        await page.addScriptTag({ content: readFileSync(clarityJsPath, "utf-8") });
    });

    for (const pageHeadings of [false, true]) {
        test(`skips post-traversal work after cancellation (headings ${pageHeadings})`, async ({ page }) => {
            const result = await page.evaluate(async (enabled: boolean) => {
                const capture = window as DiscoveryWindow;
                const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "adoptedStyleSheets");
                let styleReads = 0;
                Object.defineProperty(document, "adoptedStyleSheets", {
                    configurable: true,
                    get(): CSSStyleSheet[] {
                        styleReads++;
                        return descriptor.get.call(document);
                    }
                });
                capture.clarity("start", {
                    projectId: "test", track: false, delay: 50, pageHeadings: enabled,
                    upload: (): void => undefined
                });
                capture.clarity("stop");
                const readsAtStop = styleReads;
                await new Promise<void>((resolve): number => window.setTimeout(resolve, 50));
                return { readsAtStop, laterStyleReads: styleReads - readsAtStop, errors: capture.discoveryErrors };
            }, pageHeadings);

            expect(result.readsAtStop).toBeGreaterThan(0);
            expect(result.laterStyleReads).toBe(0);
            expect(result.errors).toEqual([]);
        });

        test(`skips timer cleanup when encoding cancels discovery (headings ${pageHeadings})`, async ({ page }) => {
            const result = await page.evaluate(async (enabled: boolean) => {
                const capture = window as DiscoveryWindow;
                let stoppedDuringEncoding = false;
                Object.defineProperty(document.getElementById("masked"), "offsetWidth", {
                    configurable: true,
                    get(): number {
                        if (!stoppedDuringEncoding) {
                            stoppedDuringEncoding = true;
                            capture.clarity("stop");
                        }
                        return 10;
                    }
                });
                capture.clarity("start", {
                    projectId: "test", track: false, delay: 50, pageHeadings: enabled,
                    upload: (): void => undefined
                });
                await new Promise<void>((resolve): number => window.setTimeout(resolve, 100));
                return { stoppedDuringEncoding, errors: capture.discoveryErrors };
            }, pageHeadings);

            expect(result.stoppedDuringEncoding).toBe(true);
            expect(result.errors).toEqual([]);
        });
    }
});
