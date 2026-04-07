import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Cookie attribute tests - Verifies that document.cookie assignments include the correct
 * attributes based on the trackEmbedded config option. Tests load the built clarity.min.js
 * in a browser context and intercept raw cookie assignments to inspect their attributes.
 */

// Maximum time to wait for Clarity to write cookies after start
const COOKIE_WRITE_TIMEOUT = 2000;

const clarityJsPath = join(__dirname, "../build/clarity.min.js");

/**
 * Sets up a cookie mock that both stores cookies (so reads work) and records
 * the raw assignment strings so tests can inspect attributes like SameSite and Secure.
 */
function setupCookieCaptureMock(): void {
    let cookieStore = "";
    const rawAssignments: string[] = [];
    (window as any).__cookieAssignments = rawAssignments;

    Object.defineProperty(document, "cookie", {
        get: (): string => cookieStore,
        set: (value: string): void => {
            rawAssignments.push(value);
            // Handle cookie deletion (max-age=- or empty value patterns)
            if (value.includes("max-age=-") || value.includes("=;") || value.includes("=^;")) {
                const cookieName = value.split("=")[0];
                const cookies = cookieStore.split("; ").filter((c: string) => !c.startsWith(cookieName + "="));
                cookieStore = cookies.join("; ");
            } else {
                // Store only the name=value portion (strip attributes) so subsequent reads work
                const cookieName = value.split("=")[0];
                const cookies = cookieStore.split("; ").filter((c: string) => !c.startsWith(cookieName + "="));
                cookies.push(value.split(";")[0]);
                cookieStore = cookies.filter((c: string) => c).join("; ");
            }
        },
        configurable: true,
    });
}

test.describe("Cookie - trackEmbedded config", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("data:text/html,<!DOCTYPE html><html><head></head><body></body></html>");
        const clarityJs = readFileSync(clarityJsPath, "utf-8");
        await page.evaluate((code: string) => {
            eval(code);
        }, clarityJs);
    });

    test("trackEmbedded=false (default): cookies are set without SameSite=None or Secure", async ({ page }) => {
        await page.evaluate(setupCookieCaptureMock as () => void);

        await page.evaluate(({ timeout }) => {
            return new Promise<void>((resolve) => {
                (window as any).clarity("start", {
                    projectId: "test",
                    track: true,
                    upload: false,
                    // trackEmbedded not set — defaults to false
                });

                // Wait for cookies to be written via consent callback
                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) { resolve(); }
                }, false, true, true);

                setTimeout(resolve, timeout);
            });
        }, { timeout: COOKIE_WRITE_TIMEOUT });

        const rawAssignments = await page.evaluate((): string[] => (window as any).__cookieAssignments);

        // At least one cookie must have been written
        expect(rawAssignments.length).toBeGreaterThan(0);

        // None of the assignments should carry SameSite=None or Secure
        const withSameSite = rawAssignments.filter((a: string) => /samesite=none/i.test(a));
        const withSecure = rawAssignments.filter((a: string) => /;\s*secure\b/i.test(a));
        expect(withSameSite).toHaveLength(0);
        expect(withSecure).toHaveLength(0);
    });

    test("trackEmbedded=true: cookies are set with SameSite=None and Secure", async ({ page }) => {
        await page.evaluate(setupCookieCaptureMock as () => void);

        await page.evaluate(({ timeout }) => {
            return new Promise<void>((resolve) => {
                (window as any).clarity("start", {
                    projectId: "test",
                    track: true,
                    trackEmbedded: true,
                    upload: false,
                });

                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) { resolve(); }
                }, false, true, true);

                setTimeout(resolve, timeout);
            });
        }, { timeout: COOKIE_WRITE_TIMEOUT });

        const rawAssignments = await page.evaluate((): string[] => (window as any).__cookieAssignments);

        expect(rawAssignments.length).toBeGreaterThan(0);

        // Every non-deletion cookie assignment must carry SameSite=None and Secure
        const cookieWrites = rawAssignments.filter((a: string) =>
            !a.includes("max-age=-") && !a.includes("=;") && !a.includes("=^;")
        );
        expect(cookieWrites.length).toBeGreaterThan(0);

        cookieWrites.forEach((assignment: string) => {
            expect(assignment).toMatch(/samesite=none/i);
            expect(assignment).toMatch(/;\s*secure\b/i);
        });
    });
});
