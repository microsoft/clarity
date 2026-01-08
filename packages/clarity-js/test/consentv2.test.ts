import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Consent API tests - Tests the production consent functionality by loading
 * the built clarity.min.js in a browser context. This approach tests the actual
 * artifact that ships to users rather than individual source modules.
 */

const Constant = {
    Granted: "granted",
    Denied: "denied",
} as const;

// Timeout constants for async consent operations
const CONSENT_CALLBACK_TIMEOUT = 2000;
const COOKIE_SETUP_DELAY = 500;

// Use the minified browser build which properly exposes window.clarity
const clarityJsPath = join(__dirname, "../build/clarity.min.js");

/**
 * Sets up a cookie mock for data: URLs which don't support cookies natively.
 * Handles both cookie setting and deletion (via max-age or empty values).
 */
function setupCookieMock() {
    let cookieStore = "";
    Object.defineProperty(document, "cookie", {
        get: () => cookieStore,
        set: (value: string) => {
            if (value.includes("max-age=-") || value.includes("=;") || value.includes("=^;")) {
                const cookieName = value.split("=")[0];
                const cookies = cookieStore.split("; ").filter(c => !c.startsWith(cookieName + "="));
                cookieStore = cookies.join("; ");
            } else {
                const cookieName = value.split("=")[0];
                const cookies = cookieStore.split("; ").filter(c => !c.startsWith(cookieName + "="));
                cookies.push(value.split(";")[0]);
                cookieStore = cookies.filter(c => c).join("; ");
            }
        },
        configurable: true
    });
}

test.describe("consentv2 - Production API", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("data:text/html,<!DOCTYPE html><html><head></head><body></body></html>");

        // Expose timeout constants to the page context
        await page.evaluate(({ timeout, delay }) => {
            (window as any).CONSENT_CALLBACK_TIMEOUT = timeout;
            (window as any).COOKIE_SETUP_DELAY = delay;
        }, { timeout: CONSENT_CALLBACK_TIMEOUT, delay: COOKIE_SETUP_DELAY });

        const clarityJs = readFileSync(clarityJsPath, "utf-8");
        await page.evaluate((code) => {
            eval(code);
        }, clarityJs);
    });

    // ========================
    // track=false tests
    // ========================

    test("implicit denied: track=false results in denied consent", async ({ page }) => {
        const result = await page.evaluate(() => {
            return new Promise((resolve) => {
                let consentInfo: any = null;

                // Start clarity with track=false (cookies disabled, no network calls)
                (window as any).clarity("start", {
                    projectId: "test",
                    track: false,
                    upload: false
                });

                // Register metadata callback AFTER starting clarity
                // Signature: clarity('metadata', callback, wait, recall, consentInfo)
                // The callback receives (data, upgrade, consent)
                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent && !consentInfo) {
                        consentInfo = consent;
                        resolve({ hasConsent: true, consent });
                    }
                }, false, true, true);

                // Timeout fallback
                setTimeout(() => {
                    if (!consentInfo) {
                        resolve({ hasConsent: false, consent: null });
                    }
                }, (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        });

        expect(result).toBeTruthy();
        expect((result as any).hasConsent).toBe(true);

        const consentState = (result as any).consent;
        expect(consentState).toBeTruthy();
        expect(consentState.source).toBe(0); // Implicit source (0 = implicit, set by config.track)
        expect(consentState.ad_Storage).toBe(Constant.Denied);
        expect(consentState.analytics_Storage).toBe(Constant.Denied);
    });

    test("cookie consent: track=false with consent cookie results in granted", async ({ page }) => {
        const result = await page.evaluate(() => {
            return new Promise((resolve) => {
                let consentInfo: any = null;

                // Mock document.cookie to simulate a consent cookie
                // Format: _clck cookie with consent flag set to 1 (granted)
                // Cookie format: userId|version|expiry|consent|dob
                const userId = "testuser123";
                const version = "2";
                const expiry = Math.ceil((Date.now() + 31536e6) / 864e5).toString(36);
                const consent = "1"; // 1 = granted
                const dob = "0";

                Object.defineProperty(document, "cookie", {
                    writable: true,
                    value: `_clck=${userId}^${version}^${expiry}^${consent}^${dob}`
                });

                // Start clarity with track=false but with consent cookie present
                (window as any).clarity("start", {
                    projectId: "test",
                    track: false,
                    upload: false
                });

                // Register metadata callback
                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent && !consentInfo) {
                        consentInfo = consent;
                        resolve({ hasConsent: true, consent });
                    }
                }, false, true, true);

                // Timeout fallback
                setTimeout(() => {
                    if (!consentInfo) {
                        resolve({ hasConsent: false, consent: null });
                    }
                }, (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        });

        expect(result).toBeTruthy();
        expect((result as any).hasConsent).toBe(true);

        const consentState = (result as any).consent;
        expect(consentState).toBeTruthy();
        expect(consentState.source).toBe(6); // Cookie source (6 = from cookie)
        expect(consentState.ad_Storage).toBe(Constant.Granted);
        expect(consentState.analytics_Storage).toBe(Constant.Granted);
    });

    test("consentv2 explicit denial: track=false → denied/denied remains without cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock);

        // Start with track=false (implicit denied), then explicitly deny via consentv2
        const result = await page.evaluate(() => {
            return new Promise((resolve) => {
                (window as any).clarity("start", {
                    projectId: "test",
                    track: false,
                    upload: false
                });

                setTimeout(() => {
                    (window as any).clarity("consentv2", {
                        ad_Storage: "denied",
                        analytics_Storage: "denied"
                    });

                    (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                        if (consent) {
                            const cookies = document.cookie;
                            resolve({
                                consent,
                                hasClskCookie: cookies.includes("_clsk="),
                                hasClckCookie: cookies.includes("_clck=")
                            });
                        }
                    }, false, false, true);
                }, (window as any).COOKIE_SETUP_DELAY);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        });

        expect(result).toBeTruthy();
        expect((result as any).consent.source).toBe(5);
        expect((result as any).consent.ad_Storage).toBe(Constant.Denied);
        expect((result as any).consent.analytics_Storage).toBe(Constant.Denied);
        // Verify cookies are not set when analytics denied
        expect((result as any).hasClskCookie).toBe(false);
        expect((result as any).hasClckCookie).toBe(false);
    });

    test("consentv2 mixed consent: track=false → denied analytics, granted ads no cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock);

        const result = await page.evaluate(() => {
            return new Promise((resolve) => {
                (window as any).clarity("start", {
                    projectId: "test",
                    track: false,
                    upload: false
                });

                (window as any).clarity("consentv2", {
                    ad_Storage: "granted",
                    analytics_Storage: "denied"
                });

                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) {
                        const cookies = document.cookie;
                        resolve({
                            consent,
                            hasClskCookie: cookies.includes("_clsk="),
                            hasClckCookie: cookies.includes("_clck=")
                        });
                    }
                }, false, false, true);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        });

        expect(result).toBeTruthy();
        expect((result as any).consent.source).toBe(5);
        expect((result as any).consent.ad_Storage).toBe(Constant.Granted);
        expect((result as any).consent.analytics_Storage).toBe(Constant.Denied);
        // Verify cookies are deleted when analytics is denied (regardless of ads)
        expect((result as any).hasClskCookie).toBe(false);
        expect((result as any).hasClckCookie).toBe(false);
    });

    test("consentv2 mixed consent: track=false → granted analytics, denied ads sets cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock);

        // Start with track=false, then grant analytics but deny ads
        const result = await page.evaluate(() => {
            return new Promise((resolve) => {
                (window as any).clarity("start", {
                    projectId: "test",
                    track: false,
                    upload: false
                });

                setTimeout(() => {
                    (window as any).clarity("consentv2", {
                        ad_Storage: "denied",
                        analytics_Storage: "granted"
                    });

                    (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                        if (consent) {
                            const cookies = document.cookie;
                            resolve({
                                consent,
                                hasClskCookie: cookies.includes("_clsk="),
                                hasClckCookie: cookies.includes("_clck=")
                            });
                        }
                    }, false, false, true);
                }, (window as any).COOKIE_SETUP_DELAY);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        });

        expect(result).toBeTruthy();
        expect((result as any).consent.source).toBe(5);
        expect((result as any).consent.ad_Storage).toBe(Constant.Denied);
        expect((result as any).consent.analytics_Storage).toBe(Constant.Granted);
        // Verify _clck cookie is set when analytics granted (even if ads denied)
        expect((result as any).hasClckCookie).toBe(true);
    });

    test("consentv2 grants consent: track=false → granted/granted sets cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock);

        // Start with track=false (implicit denied)
        const initialConsent = await page.evaluate(() => {
            return new Promise((resolve) => {
                (window as any).clarity("start", {
                    projectId: "test",
                    track: false,
                    upload: false
                });

                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) {
                        resolve(consent);
                    }
                }, false, false, true);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        });

        expect(initialConsent).toBeTruthy();
        expect((initialConsent as any).source).toBe(0);
        expect((initialConsent as any).ad_Storage).toBe(Constant.Denied);
        expect((initialConsent as any).analytics_Storage).toBe(Constant.Denied);

        // Grant consent via consentv2 API
        const updatedConsent = await page.evaluate(() => {
            return new Promise((resolve) => {
                (window as any).clarity("consentv2", {
                    ad_Storage: "granted",
                    analytics_Storage: "granted"
                });

                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) {
                        const cookies = document.cookie;
                        resolve({
                            consent,
                            hasClskCookie: cookies.includes("_clsk="),
                            hasClckCookie: cookies.includes("_clck=")
                        });
                    }
                }, false, false, true);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        });

        expect(updatedConsent).toBeTruthy();
        expect((updatedConsent as any).consent.source).toBe(5);
        expect((updatedConsent as any).consent.ad_Storage).toBe(Constant.Granted);
        expect((updatedConsent as any).consent.analytics_Storage).toBe(Constant.Granted);
        // Verify cookies are set when consent is granted
        expect((updatedConsent as any).hasClskCookie).toBe(true);
        expect((updatedConsent as any).hasClckCookie).toBe(true);
    });

    // ========================
    // track=true tests
    // ========================

    test("implicit granted: track=true results in granted consent", async ({ page }) => {
        const result = await page.evaluate(() => {
            return new Promise((resolve) => {
                let consentInfo: any = null;

                // Mock document.cookie to handle cookie operations in data: URL
                let cookieStore = "";
                Object.defineProperty(document, "cookie", {
                    get: () => cookieStore,
                    set: (value: string) => {
                        cookieStore = value;
                    },
                    configurable: true
                });

                // Start clarity with track=true (implicit granted consent)
                (window as any).clarity("start", {
                    projectId: "test",
                    track: true,
                    upload: false
                });

                // Register metadata callback
                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent && !consentInfo) {
                        consentInfo = consent;
                        resolve({ hasConsent: true, consent });
                    }
                }, false, true, true);

                // Timeout fallback
                setTimeout(() => {
                    if (!consentInfo) {
                        resolve({ hasConsent: false, consent: null });
                    }
                }, (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        });

        expect(result).toBeTruthy();
        expect((result as any).hasConsent).toBe(true);

        const consentState = (result as any).consent;
        expect(consentState).toBeTruthy();
        expect(consentState.source).toBe(0); // Implicit source (0 = implicit, set by config.track)
        expect(consentState.ad_Storage).toBe(Constant.Granted);
        expect(consentState.analytics_Storage).toBe(Constant.Granted);
    });

    test("consentv2 revokes consent: track=true → denied/denied deletes cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock);

        // Step 1: Start with track=true and verify initial granted state
        const initialConsent = await page.evaluate(() => {
            return new Promise((resolve) => {
                // Start clarity with track=true (implicit granted consent)
                (window as any).clarity("start", {
                    projectId: "test",
                    track: true,
                    upload: false
                });

                // Get initial consent state
                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) {
                        resolve(consent);
                    }
                }, false, false, true);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        });

        // Verify initial state: implicit granted
        expect(initialConsent).toBeTruthy();
        expect((initialConsent as any).source).toBe(0);
        expect((initialConsent as any).ad_Storage).toBe(Constant.Granted);
        expect((initialConsent as any).analytics_Storage).toBe(Constant.Granted);

        // Step 2: Call consentv2 API to deny consent and verify updated state
        const updatedConsent = await page.evaluate(() => {
            return new Promise((resolve) => {
                // Call consentv2 to deny consent
                (window as any).clarity("consentv2", {
                    ad_Storage: "denied",
                    analytics_Storage: "denied"
                });

                // Get updated consent state and cookie status
                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) {
                        const cookies = document.cookie;
                        const hasClskCookie = cookies.includes("_clsk=");
                        const hasClckCookie = cookies.includes("_clck=");
                        resolve({
                            consent,
                            hasClskCookie,
                            hasClckCookie
                        });
                    }
                }, false, false, true);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        });

        // Verify updated state: explicit denied
        expect(updatedConsent).toBeTruthy();
        expect((updatedConsent as any).consent.source).toBe(5); // Explicit API source (5 = consentv2 API)
        expect((updatedConsent as any).consent.ad_Storage).toBe(Constant.Denied);
        expect((updatedConsent as any).consent.analytics_Storage).toBe(Constant.Denied);

        // Verify both cookies are deleted after consent is denied
        expect((updatedConsent as any).hasClskCookie).toBe(false);
        expect((updatedConsent as any).hasClckCookie).toBe(false);
    });

    test("consentv2 mixed consent: track=true → granted analytics, denied ads keeps cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock);

        const result = await page.evaluate(() => {
            return new Promise((resolve) => {
                (window as any).clarity("start", {
                    projectId: "test",
                    track: true,
                    upload: false
                });

                (window as any).clarity("consentv2", {
                    ad_Storage: "denied",
                    analytics_Storage: "granted"
                });

                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) {
                        const cookies = document.cookie;
                        resolve({
                            consent,
                            hasClskCookie: cookies.includes("_clsk="),
                            hasClckCookie: cookies.includes("_clck=")
                        });
                    }
                }, false, false, true);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        });

        expect(result).toBeTruthy();
        expect((result as any).consent.source).toBe(5);
        expect((result as any).consent.ad_Storage).toBe(Constant.Denied);
        expect((result as any).consent.analytics_Storage).toBe(Constant.Granted);
        // Verify cookies remain when analytics is granted (even if ads is denied)
        expect((result as any).hasClskCookie).toBe(true);
        expect((result as any).hasClckCookie).toBe(true);
    });

    test("consentv2 mixed consent: track=true → denied analytics, granted ads deletes cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock);

        // Start with track=true, then deny analytics but grant ads
        const result = await page.evaluate(() => {
            return new Promise((resolve) => {
                (window as any).clarity("start", {
                    projectId: "test",
                    track: true,
                    upload: false
                });

                setTimeout(() => {
                    (window as any).clarity("consentv2", {
                        ad_Storage: "granted",
                        analytics_Storage: "denied"
                    });

                    (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                        if (consent) {
                            const cookies = document.cookie;
                            resolve({
                                consent,
                                hasClskCookie: cookies.includes("_clsk="),
                                hasClckCookie: cookies.includes("_clck=")
                            });
                        }
                    }, false, false, true);
                }, (window as any).COOKIE_SETUP_DELAY);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        });

        expect(result).toBeTruthy();
        expect((result as any).consent.source).toBe(5);
        expect((result as any).consent.ad_Storage).toBe(Constant.Granted);
        expect((result as any).consent.analytics_Storage).toBe(Constant.Denied);
        // Verify cookies are deleted when analytics denied (even if ads granted)
        expect((result as any).hasClskCookie).toBe(false);
        expect((result as any).hasClckCookie).toBe(false);
    });

    test("consentv2 maintains consent: track=true → granted/granted keeps cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock);

        // Start with track=true (implicit granted)
        const initialConsent = await page.evaluate(() => {
            return new Promise((resolve) => {
                (window as any).clarity("start", {
                    projectId: "test",
                    track: true,
                    upload: false
                });

                // Wait a bit for cookies to be set, then check
                setTimeout(() => {
                    (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                        if (consent) {
                            const cookies = document.cookie;
                            resolve({
                                consent,
                                cookies: cookies,
                                hasClskCookie: cookies.includes("_clsk="),
                                hasClckCookie: cookies.includes("_clck=")
                            });
                        }
                    }, false, false, true);
                }, (window as any).COOKIE_SETUP_DELAY);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        });

        // Verify initial state: implicit granted
        expect(initialConsent).toBeTruthy();
        expect((initialConsent as any).consent.source).toBe(0);
        expect((initialConsent as any).consent.ad_Storage).toBe(Constant.Granted);
        expect((initialConsent as any).consent.analytics_Storage).toBe(Constant.Granted);
        // Note: _clsk cookie is only written during upload operations (metadata.save()), not during initial setup
        // With upload: false in test config, only _clck is written by track() function during initialization
        expect((initialConsent as any).hasClckCookie).toBe(true);

        // Explicitly grant via consentv2 API (should maintain granted state)
        const result = await page.evaluate(() => {
            return new Promise((resolve) => {
                (window as any).clarity("consentv2", {
                    ad_Storage: "granted",
                    analytics_Storage: "granted"
                });

                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) {
                        const cookies = document.cookie;
                        resolve({
                            consent,
                            hasClskCookie: cookies.includes("_clsk="),
                            hasClckCookie: cookies.includes("_clck=")
                        });
                    }
                }, false, false, true);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        });

        expect(result).toBeTruthy();
        expect((result as any).consent.source).toBe(5);
        expect((result as any).consent.ad_Storage).toBe(Constant.Granted);
        expect((result as any).consent.analytics_Storage).toBe(Constant.Granted);
        // Verify _clck cookie remains set (user ID/consent preference cookie)
        // Note: _clsk is only written during upload operations, so we only check _clck in tests with upload: false
        expect((result as any).hasClckCookie).toBe(true);
    });
});
