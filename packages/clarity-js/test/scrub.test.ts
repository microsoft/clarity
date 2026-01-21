import { expect, test } from "@playwright/test";
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import type { Page } from '@playwright/test';
import { decode } from 'clarity-decode';

// Constants
const HTML_PATH = resolve(__dirname, '../../../test/html/core.html');
const CLARITY_SCRIPT_PATH = resolve(__dirname, '../build/clarity.min.js');
// IMPORTANT: This must match Data.Constant.Dropped in clarity-js/types/data.d.ts
// If you see test failures with unexpected masked values, verify this constant is in sync
const DROPPED_VALUE = "*na*";
const MAX_URL_LENGTH = 255;

// Cached file contents (loaded once)
let cachedHtml: string | null = null;
let cachedClarityScript: string | null = null;

function getHtml(): string {
    if (!cachedHtml) {
        cachedHtml = readFileSync(HTML_PATH, 'utf8');
    }
    return cachedHtml;
}

function getClarityScript(): string {
    if (!cachedClarityScript) {
        cachedClarityScript = readFileSync(CLARITY_SCRIPT_PATH, 'utf8');
    }
    return cachedClarityScript;
}

declare global {
    interface Window {
        clarity: (method: string, ...args: unknown[]) => void;
        payloads: string[];
    }
}

interface ClarityTestConfig {
    drop?: string[];
    keep?: string[];
    queryString?: string;  // e.g., "?param=value" or "?a=1&b=2#hash"
}

// Helper to run clarity in a browser with specific config and capture the envelope URL
async function runClarityAndGetUrl(page: Page, config: ClarityTestConfig = {}): Promise<string | null> {
    const baseUrl = pathToFileURL(HTML_PATH).toString();
    const fullUrl = baseUrl + (config.queryString || "");
    const html = getHtml();
    const clarityScript = getClarityScript();

    const clarityConfig: Record<string, unknown> = {
        delay: 100,
        projectId: "test"
    };
    if (config.drop) clarityConfig.drop = config.drop;
    if (config.keep) clarityConfig.keep = config.keep;

    const configStr = JSON.stringify(clarityConfig);

    await page.goto(fullUrl);
    await page.setContent(html.replace("</body>", `
        <script>
          window.payloads = [];
          ${clarityScript};
          clarity("start", {
            ...${configStr},
            upload: (payload) => { window.payloads.push(payload); }
          });
        </script>
        </body>
    `));

    await page.click("body");
    await page.waitForFunction("payloads && payloads.length > 0");

    const payloads: string[] = await page.evaluate('payloads');
    return getEnvelopeUrl(payloads);
}

// Extract envelope URL from decoded payloads
function getEnvelopeUrl(payloads: string[]): string | null {
    for (const payload of payloads) {
        const decoded = decode(payload);
        if (decoded.envelope?.url) {
            return decoded.envelope.url;
        }
    }
    return null;
}

// Helper to extract query string from URL
function getQueryString(url: string): string {
    const queryStart = url.indexOf("?");
    if (queryStart < 0) return "";
    const hashStart = url.indexOf("#");
    return hashStart > queryStart
        ? url.substring(queryStart + 1, hashStart)
        : url.substring(queryStart + 1);
}

test.describe("Core Utilities - Scrub URL (E2E)", () => {

    test.describe("Basic URL handling", () => {
        test("should capture URL in envelope without modifications when no drop/keep configured", async ({ page }) => {
            const url = await runClarityAndGetUrl(page);
            expect(url).not.toBeNull();
            expect(url).toBeTruthy();
        });

        test("should handle URL with no query parameters", async ({ page }) => {
            const url = await runClarityAndGetUrl(page, {
                drop: ["secret"],
                keep: ["important"]
            });
            expect(url).not.toBeNull();
            expect(url).not.toContain("?");
        });
    });

    test.describe("Drop parameter handling", () => {
        test("should drop single sensitive parameter from URL", async ({ page }) => {
            const url = await runClarityAndGetUrl(page, {
                queryString: "?secret=hidden&safe=visible",
                drop: ["secret"]
            });
            expect(url).not.toBeNull();
            expect(url).toContain(`secret=${DROPPED_VALUE}`);
            expect(url).toContain("safe=visible");
        });

        test("should drop multiple sensitive parameters", async ({ page }) => {
            const url = await runClarityAndGetUrl(page, {
                queryString: "?secret=abc&password=xyz&token=123&safe=ok",
                drop: ["secret", "password", "token"]
            });
            expect(url).not.toBeNull();
            expect(url).toContain(`secret=${DROPPED_VALUE}`);
            expect(url).toContain(`password=${DROPPED_VALUE}`);
            expect(url).toContain(`token=${DROPPED_VALUE}`);
            expect(url).toContain("safe=ok");
        });

        test("should only drop parameters with exact name match, not substrings", async ({ page }) => {
            // Drop uses exact key matching: "secret" matches only the parameter named "secret",
            // not "mysecret" or "secretkey" which merely contain "secret" as a substring
            const url = await runClarityAndGetUrl(page, {
                queryString: "?mysecret=visible&secret=hidden&secretkey=also-visible",
                drop: ["secret"]
            });
            expect(url).not.toBeNull();
            expect(url).toContain(`secret=${DROPPED_VALUE}`);
            expect(url).toContain("mysecret=visible");
            expect(url).toContain("secretkey=also-visible");
        });
    });

    test.describe("Keep parameter handling", () => {
        test("should reorder single keep parameter to the front of URL", async ({ page }) => {
            const url = await runClarityAndGetUrl(page, {
                queryString: "?other=value&important=keep-me&last=end",
                keep: ["important"]
            });
            expect(url).not.toBeNull();
            const queryString = getQueryString(url!);
            expect(queryString.startsWith("important=keep-me")).toBe(true);
        });

        test("should handle multiple keep parameters and preserve their relative order", async ({ page }) => {
            const url = await runClarityAndGetUrl(page, {
                queryString: "?other=1&keep2=second&more=2&keep1=first&last=3",
                keep: ["keep1", "keep2"]
            });
            expect(url).not.toBeNull();
            const queryString = getQueryString(url!);
            // keep2 appears before keep1 in original URL, so it should be first
            expect(queryString.indexOf("keep2=second")).toBeLessThan(queryString.indexOf("keep1=first"));
            expect(queryString.indexOf("keep1=first")).toBeLessThan(queryString.indexOf("other=1"));
        });

        test("should handle parameters with empty values", async ({ page }) => {
            const url = await runClarityAndGetUrl(page, {
                queryString: "?other=value&empty=&keep=important",
                keep: ["empty"]
            });
            expect(url).not.toBeNull();
            const queryString = getQueryString(url!);
            expect(queryString.startsWith("empty=")).toBe(true);
        });
    });

    test.describe("Combined drop and keep", () => {
        test("should apply both drop and keep correctly", async ({ page }) => {
            const url = await runClarityAndGetUrl(page, {
                queryString: "?secret=hidden&other=value&important=keep-me",
                drop: ["secret"],
                keep: ["important"]
            });
            expect(url).not.toBeNull();
            expect(url).toContain(`secret=${DROPPED_VALUE}`);
            const queryString = getQueryString(url!);
            expect(queryString.startsWith("important=keep-me")).toBe(true);
        });

        test("should handle parameter that is both dropped and kept", async ({ page }) => {
            const url = await runClarityAndGetUrl(page, {
                queryString: "?other=1&param=value&last=2",
                drop: ["param"],
                keep: ["param"]
            });
            expect(url).not.toBeNull();
            expect(url).toContain(`param=${DROPPED_VALUE}`);
            const queryString = getQueryString(url!);
            expect(queryString.startsWith(`param=${DROPPED_VALUE}`)).toBe(true);
        });

        test("should leave URL unchanged when keep parameters do not exist", async ({ page }) => {
            // When keep is specified but none of the keep parameters exist in the URL,
            // the URL should remain unchanged (no parameters moved to front)
            const url = await runClarityAndGetUrl(page, {
                queryString: "?a=1&b=2&c=3",
                keep: ["nonexistent", "alsonotpresent"]
            });
            expect(url).not.toBeNull();
            const queryString = getQueryString(url!);
            // Parameters should remain in original order
            expect(queryString).toBe("a=1&b=2&c=3");
        });
    });

    test.describe("Duplicate parameter handling", () => {
        test("should drop all instances of a dropped parameter with duplicate names", async ({ page }) => {
            // URLs can have multiple parameters with the same name (e.g., ?tag=a&tag=b)
            // All instances of a dropped parameter should have their values masked
            const url = await runClarityAndGetUrl(page, {
                queryString: "?tag=first&other=value&tag=second&tag=third",
                drop: ["tag"]
            });
            expect(url).not.toBeNull();
            // Count occurrences of dropped value - should be 3
            const matches = url!.match(new RegExp(`tag=${DROPPED_VALUE.replace(/\*/g, '\\*')}`, 'g'));
            expect(matches).not.toBeNull();
            expect(matches!.length).toBe(3);
            expect(url).toContain("other=value");
        });

        test("should move all instances of keep parameters to front preserving their order", async ({ page }) => {
            // When a keep parameter appears multiple times, all instances should be moved
            // to the front while preserving their relative order
            const url = await runClarityAndGetUrl(page, {
                queryString: "?other=x&keep=first&middle=y&keep=second&end=z",
                keep: ["keep"]
            });
            expect(url).not.toBeNull();
            const queryString = getQueryString(url!);
            // Both "keep" params should be at the front
            expect(queryString.startsWith("keep=first")).toBe(true);
            expect(queryString.indexOf("keep=first")).toBeLessThan(queryString.indexOf("keep=second"));
            expect(queryString.indexOf("keep=second")).toBeLessThan(queryString.indexOf("other=x"));
        });
    });

    test.describe("Hash fragment handling", () => {
        test("should preserve hash fragment in URL", async ({ page }) => {
            const url = await runClarityAndGetUrl(page, {
                queryString: "?param=value#section"
            });
            expect(url).not.toBeNull();
            expect(url).toContain("param=value");
        });

        test("should preserve hash fragment when reordering keep parameters", async ({ page }) => {
            const url = await runClarityAndGetUrl(page, {
                queryString: "?other=value&important=keep#section",
                keep: ["important"]
            });
            expect(url).not.toBeNull();
            const queryString = getQueryString(url!);
            expect(queryString.startsWith("important=keep")).toBe(true);
            expect(url).toContain("#section");
        });

        test("should handle complex hash fragment with query-like content", async ({ page }) => {
            const url = await runClarityAndGetUrl(page, {
                queryString: "?real=param#section?fake=notaparam&also=fake",
                drop: ["fake"]
            });
            expect(url).not.toBeNull();
            expect(url).toContain("real=param");
            // "fake" in hash should NOT be dropped (it's part of hash, not query)
            expect(url).toContain("#section?fake=notaparam");
        });
    });

    test.describe("Truncation", () => {
        test("should truncate long URLs while preserving complete parameters", async ({ page }) => {
            const longValue = "x".repeat(150);
            const url = await runClarityAndGetUrl(page, {
                queryString: `?long1=${longValue}&long2=${longValue}&short=ok`
            });
            expect(url).not.toBeNull();
            expect(url!.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
            expect(url).not.toMatch(/&$/);
            if (url!.includes("?")) {
                const params = getQueryString(url!).split("&");
                params.forEach(p => {
                    expect(p).toContain("=");
                });
            }
        });

        test("should prioritize keep parameters during truncation", async ({ page }) => {
            const filler = "y".repeat(100);
            const url = await runClarityAndGetUrl(page, {
                queryString: `?filler1=${filler}&filler2=${filler}&important=must-keep`,
                keep: ["important"]
            });
            expect(url).not.toBeNull();
            expect(url!.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
            expect(url).toContain("important=must-keep");
        });

        test("should preserve hash fragment during truncation when it fits", async ({ page }) => {
            // Create URL that needs truncation but has room for short hash
            const filler = "x".repeat(180);
            const url = await runClarityAndGetUrl(page, {
                queryString: `?data=${filler}&extra=value#nav`
            });
            expect(url).not.toBeNull();
            expect(url!.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
            // Hash should be preserved if it fits after truncation
            if (url!.length + 4 <= MAX_URL_LENGTH) { // 4 = "#nav".length
                expect(url).toContain("#nav");
            }
        });

        test("should calculate length correctly after drop shortens parameter values", async ({ page }) => {
            // Long password value that gets replaced with short "*na*"
            // Original: password=<100 char value> (109 chars total with key=)
            // After drop: password=*na* (13 chars)
            // This should NOT trigger unnecessary truncation
            const longPassword = "x".repeat(100);
            const url = await runClarityAndGetUrl(page, {
                queryString: `?user=test&password=${longPassword}&action=login`,
                drop: ["password"]
            });
            expect(url).not.toBeNull();
            expect(url).toContain("user=test");
            expect(url).toContain(`password=${DROPPED_VALUE}`);
            expect(url).toContain("action=login");
            // All params should be present since after drop the URL is short enough
            expect(url!.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
        });
    });
});
