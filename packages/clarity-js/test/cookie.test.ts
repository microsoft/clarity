import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Cookie domain deletion tests - loads the built clarity.min.js in a browser and verifies
 * that domain-scoped cookies can be deleted even when the first cookie operation in a runtime
 * is a deletion (empty value).
 *
 * Regression test for issue #1105: revoking consent failed to delete an existing domain-scoped
 * _clck cookie on multi-label hosts (e.g. app.example.com). Root-domain discovery used to verify
 * success by reading back the written value, which can never match for a deletion, poisoning the
 * cached root domain to empty and leaving the domain-scoped cookie undeletable. Deletions now
 * target the current host and every writable parent domain instead of depending on discovery.
 */

// Use the minified browser build which exposes window.clarity.
const clarityJsPath = join(__dirname, "../build/clarity.min.js");

// A multi-label host is required so cookie domain scoping is exercised (localhost won't trigger it).
const HOST = "http://app.example.com/";

test.describe("cookie - domain-scoped deletion", () => {
    let clarityJs: string;

    test.beforeAll(() => {
        // Load the build artifact once. Doing this here (rather than at module load) keeps a missing
        // artifact from crashing test discovery and reports it as a normal test failure instead.
        clarityJs = readFileSync(clarityJsPath, "utf-8");
    });

    test("deletes an existing domain-scoped _clck cookie when consent is revoked", async ({ context }) => {
        // Fake the multi-label host by fulfilling every request with a minimal HTML page.
        await context.route("**/*", async (route) => {
            await route.fulfill({ status: 200, contentType: "text/html", body: "<!DOCTYPE html><html><head></head><body>x</body></html>" });
        });
        const page = await context.newPage();
        await page.goto(HOST);

        // Simulate a PRIOR Clarity runtime that wrote a VALID, fresh, domain-scoped _clck at
        // .example.com. It must be a valid granted Clarity cookie so that on start track() finds it
        // fresh and skips re-writing it, leaving the internal rootDomain cache uninitialized - this
        // is the exact condition under which the bug manifested.
        await page.evaluate(() => {
            const end36 = Math.ceil((Date.now() + 365 * 86400000) / 86400000).toString(36);
            // format: userId ^ cookieVersion(2) ^ endDays(base36) ^ consent(1=granted) ^ dob(0)
            const clck = ["testuser", "2", end36, "1", "0"].join("^");
            document.cookie = "_clck=" + clck + ";path=/;domain=.example.com";
        });

        const before: string = await page.evaluate(() => document.cookie);
        expect(/(^|;)\s*_clck=/.test(before)).toBe(true);

        // Load Clarity and, in the SAME runtime, start then immediately revoke consent so that the
        // first setCookie call is a deletion (the reported scenario).
        await page.evaluate((code) => { eval(code); }, clarityJs);
        await page.evaluate(() => {
            (window as any).clarity("start", { projectId: "test", upload: false });
            (window as any).clarity("consentv2", { analytics_Storage: "denied", ad_Storage: "denied" });
        });

        // Wait until the domain-scoped _clck cookie has been removed, rather than relying on a fixed
        // delay which is timing-dependent and flaky across CI environments.
        await expect
            .poll(() => page.evaluate(() => document.cookie), { timeout: 5000 })
            .not.toMatch(/(^|;)\s*_clck=/);
    });
});
