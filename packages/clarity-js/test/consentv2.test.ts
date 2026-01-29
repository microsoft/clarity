import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Consent API tests - Tests the production consent functionality by loading
 * the built clarity.min.js in a browser context. This approach tests the actual
 * artifact that ships to users rather than individual source modules.
 */

// Type definitions for test results
interface ConsentState {
    source: number;
    ad_Storage: string;
    analytics_Storage: string;
}

/**
 * Standard result type for all consent tests.
 * Every test should capture and verify this complete state for consistent analysis.
 */
interface ConsentTestResult {
    consent: ConsentState;
    hasClskCookie: boolean;
    hasClckCookie: boolean;
    clskCookieValue: string;
    clckCookieValue: string;
    cookies: string;
}

const Constant = {
    Granted: "granted",
    Denied: "denied",
    CookieKey: "_clck",
    SessionKey: "_clsk",
} as const;

const ConsentSource = {
    Implicit: 0,
    API: 1,
    GCM: 2,
    TCF: 3,
    APIv1: 4,
    APIv2: 5,
    Cookie: 6,
    Default: 7,
} as const;

// Maximum time to wait from when consent() is called to when its callback resolves
const CONSENT_CALLBACK_TIMEOUT = 2000;
// Delay from when cookie mock is set up to when Clarity can reliably read it
const COOKIE_SETUP_DELAY = 500;

// Use the minified browser build which properly exposes window.clarity
const clarityJsPath = join(__dirname, "../build/clarity.min.js");

/**
 * Sets up a cookie mock for data: URLs which don't support cookies natively.
 * Handles both cookie setting and deletion (via max-age or empty values).
 * @param initialCookieValue - Optional initial cookie value (e.g., "marketing_id=abc123")
 */
function setupCookieMock(initialCookieValue?: string): void {
    let cookieStore = initialCookieValue || "";
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
        await page.evaluate(setupCookieMock as () => void);

        // Verify initial state (before Clarity starts) - no cookies should exist
        const initialState = await page.evaluate(({ sessionKey, cookieKey }) => {
            const cookies = document.cookie;
            return {
                cookies,
                hasClskCookie: cookies.includes(`${sessionKey}=`),
                hasClckCookie: cookies.includes(`${cookieKey}=`),
                clskCookieValue: "",
                clckCookieValue: ""
            };
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(initialState.cookies).toBe("");
        expect(initialState.hasClskCookie).toBe(false);
        expect(initialState.hasClckCookie).toBe(false);

        // Start clarity with track=false (cookies disabled, no network calls)
        const result = await page.evaluate(({ sessionKey, cookieKey }) => {
            return new Promise((resolve) => {
                (window as any).clarity("start", {
                    projectId: "test",
                    track: false,
                    upload: false
                });

                // Register metadata callback AFTER starting clarity
                // Signature: clarity('metadata', callback, wait, recall, consentInfo)
                // The callback receives (data, upgrade, consent)
                // wait=false (don't wait for data), recall=true (resend on changes), consentInfo=true (include consent)
                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) {
                        const cookies = document.cookie;
                        const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
                        const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
                        resolve({
                            consent,
                            hasClskCookie: cookies.includes(`${sessionKey}=`),
                            hasClckCookie: cookies.includes(`${cookieKey}=`),
                            clskCookieValue: clskMatch ? clskMatch[1] : "",
                            clckCookieValue: clckMatch ? clckMatch[1] : "",
                            clckConsentCrumb: clckMatch ? (clckMatch[1].split("^")[3] || "") : "",
                            cookies
                        });
                    }
                }, false, true, true);

                // Timeout fallback
                setTimeout(() => {
                    const cookies = document.cookie;
                    resolve({
                        consent: null,
                        hasClskCookie: cookies.includes(`${sessionKey}=`),
                        hasClckCookie: cookies.includes(`${cookieKey}=`),
                        clskCookieValue: "",
                        clckCookieValue: "",
                        cookies
                    });
                }, (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(result).not.toBeNull();
        const consentResult = result as ConsentTestResult;
        expect(consentResult.consent).not.toBeNull();
        expect(consentResult.consent.source).toBe(ConsentSource.Implicit);
        expect(consentResult.consent.ad_Storage).toBe(Constant.Denied);
        expect(consentResult.consent.analytics_Storage).toBe(Constant.Denied);
        // Verify cookies are not set when track=false
        expect(consentResult.hasClskCookie).toBe(false);
        expect(consentResult.hasClckCookie).toBe(false);
    });

    test("cookie consent: track=false with consent cookie results in granted", async ({ page }) => {
        // This test uses a pre-set cookie (simulating a returning user with consent)
        // so we manually mock the cookie rather than using setupCookieMock
        const result = await page.evaluate(({ sessionKey, cookieKey }) => {
            // Mock document.cookie to simulate a consent cookie
            // Format: _clck cookie with consent flag set to 1 (granted)
            // Cookie format: userId^version^expiry^consent^dob
            const userId = "testuser123";
            const version = "2";
            const expiry = Math.ceil((Date.now() + 31536e6) / 864e5).toString(36);
            const consentFlag = "1"; // 1 = granted
            const dob = "0";
            const presetCookieValue = `${userId}^${version}^${expiry}^${consentFlag}^${dob}`;

            Object.defineProperty(document, "cookie", {
                writable: true,
                value: `${cookieKey}=${presetCookieValue}`
            });

            // Capture initial state with the pre-set cookie
            const initialCookies = document.cookie;
            const initialState = {
                cookies: initialCookies,
                hasClskCookie: initialCookies.includes(`${sessionKey}=`),
                hasClckCookie: initialCookies.includes(`${cookieKey}=`),
                clckCookieValue: presetCookieValue
            };

            return new Promise((resolve) => {
                // Start clarity with track=false but with consent cookie present
                (window as any).clarity("start", {
                    projectId: "test",
                    track: false,
                    upload: false
                });

                // Register metadata callback
                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) {
                        const cookies = document.cookie;
                        const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
                        const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
                        resolve({
                            initialState,
                            consent,
                            hasClskCookie: cookies.includes(`${sessionKey}=`),
                            hasClckCookie: cookies.includes(`${cookieKey}=`),
                            clskCookieValue: clskMatch ? clskMatch[1] : "",
                            clckCookieValue: clckMatch ? clckMatch[1] : "",
                            clckConsentCrumb: clckMatch ? (clckMatch[1].split("^")[3] || "") : "",
                            cookies
                        });
                    }
                }, false, true, true);

                // Timeout fallback
                setTimeout(() => {
                    const cookies = document.cookie;
                    resolve({
                        initialState,
                        consent: null,
                        hasClskCookie: cookies.includes(`${sessionKey}=`),
                        hasClckCookie: cookies.includes(`${cookieKey}=`),
                        clskCookieValue: "",
                        clckCookieValue: "",
                        cookies
                    });
                }, (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(result).not.toBeNull();
        const consentResult = result as ConsentTestResult & { initialState: { cookies: string; hasClskCookie: boolean; hasClckCookie: boolean; clckCookieValue: string } };

        // Verify initial state had the pre-set consent cookie
        expect(consentResult.initialState.hasClckCookie).toBe(true);
        expect(consentResult.initialState.clckCookieValue).toContain("testuser123");

        // Verify consent was read from cookie
        expect(consentResult.consent).not.toBeNull();
        expect(consentResult.consent.source).toBe(ConsentSource.Cookie);
        expect(consentResult.consent.ad_Storage).toBe(Constant.Granted);
        expect(consentResult.consent.analytics_Storage).toBe(Constant.Granted);
        // Cookie should still exist
        expect(consentResult.hasClckCookie).toBe(true);
    });

    test("consentv2 explicit denial: track=false → denied/denied remains without cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock as () => void);

        // Verify initial state - no cookies before Clarity starts
        const initialState = await page.evaluate(({ sessionKey, cookieKey }) => {
            const cookies = document.cookie;
            const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
            const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
            return {
                cookies,
                hasClskCookie: cookies.includes(`${sessionKey}=`),
                hasClckCookie: cookies.includes(`${cookieKey}=`),
                clskCookieValue: clskMatch ? clskMatch[1] : "",
                clckCookieValue: clckMatch ? clckMatch[1] : ""
            };
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(initialState.cookies).toBe("");
        expect(initialState.hasClskCookie).toBe(false);
        expect(initialState.hasClckCookie).toBe(false);

        // Start with track=false (implicit denied), then explicitly deny via consentv2
        const result = await page.evaluate(({ sessionKey, cookieKey }) => {
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
                            const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
                            const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
                            resolve({
                                consent,
                                hasClskCookie: cookies.includes(`${sessionKey}=`),
                                hasClckCookie: cookies.includes(`${cookieKey}=`),
                                clskCookieValue: clskMatch ? clskMatch[1] : "",
                                clckCookieValue: clckMatch ? clckMatch[1] : "",
                                clckConsentCrumb: clckMatch ? (clckMatch[1].split("^")[3] || "") : "",
                                cookies
                            });
                        }
                    }, false, false, true);
                }, (window as any).COOKIE_SETUP_DELAY);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(result).not.toBeNull();
        const consentResult = result as ConsentTestResult;
        expect(consentResult.consent.source).toBe(ConsentSource.APIv2);
        expect(consentResult.consent.ad_Storage).toBe(Constant.Denied);
        expect(consentResult.consent.analytics_Storage).toBe(Constant.Denied);
        // Verify cookies are not set when analytics denied
        expect(consentResult.hasClskCookie).toBe(false);
        expect(consentResult.hasClckCookie).toBe(false);
        expect(consentResult.clskCookieValue).toBe("");
        expect(consentResult.clckCookieValue).toBe("");
    });

    test("consentv2 mixed consent: track=false → denied analytics, granted ads no cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock as () => void);

        // Verify initial state - no cookies before Clarity starts
        const initialState = await page.evaluate(({ sessionKey, cookieKey }) => {
            const cookies = document.cookie;
            const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
            const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
            return {
                cookies,
                hasClskCookie: cookies.includes(`${sessionKey}=`),
                hasClckCookie: cookies.includes(`${cookieKey}=`),
                clskCookieValue: clskMatch ? clskMatch[1] : "",
                clckCookieValue: clckMatch ? clckMatch[1] : ""
            };
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(initialState.cookies).toBe("");
        expect(initialState.hasClskCookie).toBe(false);
        expect(initialState.hasClckCookie).toBe(false);

        const result = await page.evaluate(({ sessionKey, cookieKey }) => {
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
                        const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
                        const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
                        resolve({
                            consent,
                            hasClskCookie: cookies.includes(`${sessionKey}=`),
                            hasClckCookie: cookies.includes(`${cookieKey}=`),
                            clskCookieValue: clskMatch ? clskMatch[1] : "",
                            clckCookieValue: clckMatch ? clckMatch[1] : "",
                            clckConsentCrumb: clckMatch ? (clckMatch[1].split("^")[3] || "") : "",
                            cookies
                        });
                    }
                }, false, false, true);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(result).not.toBeNull();
        const consentResult = result as ConsentTestResult;
        expect(consentResult.consent.source).toBe(ConsentSource.APIv2);
        expect(consentResult.consent.ad_Storage).toBe(Constant.Granted);
        expect(consentResult.consent.analytics_Storage).toBe(Constant.Denied);
        // Verify cookies are deleted when analytics is denied (regardless of ads)
        expect(consentResult.hasClskCookie).toBe(false);
        expect(consentResult.hasClckCookie).toBe(false);
        expect(consentResult.clskCookieValue).toBe("");
        expect(consentResult.clckCookieValue).toBe("");
    });

    test("consentv2 mixed consent: track=false → granted analytics, denied ads sets cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock as () => void);

        // Verify initial state - no cookies before Clarity starts
        const initialState = await page.evaluate(({ sessionKey, cookieKey }) => {
            const cookies = document.cookie;
            const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
            const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
            return {
                cookies,
                hasClskCookie: cookies.includes(`${sessionKey}=`),
                hasClckCookie: cookies.includes(`${cookieKey}=`),
                clskCookieValue: clskMatch ? clskMatch[1] : "",
                clckCookieValue: clckMatch ? clckMatch[1] : ""
            };
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(initialState.cookies).toBe("");
        expect(initialState.hasClskCookie).toBe(false);
        expect(initialState.hasClckCookie).toBe(false);

        // Start with track=false, then grant analytics but deny ads
        const result = await page.evaluate(({ sessionKey, cookieKey }) => {
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
                            const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
                            const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
                            resolve({
                                consent,
                                hasClskCookie: cookies.includes(`${sessionKey}=`),
                                hasClckCookie: cookies.includes(`${cookieKey}=`),
                                clskCookieValue: clskMatch ? clskMatch[1] : "",
                                clckCookieValue: clckMatch ? clckMatch[1] : "",
                                clckConsentCrumb: clckMatch ? (clckMatch[1].split("^")[3] || "") : "",
                                cookies
                            });
                        }
                    }, false, false, true);
                }, (window as any).COOKIE_SETUP_DELAY);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(result).not.toBeNull();
        const consentResult = result as ConsentTestResult;
        expect(consentResult.consent.source).toBe(ConsentSource.APIv2);
        expect(consentResult.consent.ad_Storage).toBe(Constant.Denied);
        expect(consentResult.consent.analytics_Storage).toBe(Constant.Granted);
        // Verify _clck cookie is set when analytics granted (even if ads denied)
        expect(consentResult.hasClckCookie).toBe(true);
        expect(consentResult.clckCookieValue).not.toBe("");
    });

    test("consentv2 grants consent: track=false → granted/granted sets cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock as () => void);

        // Verify initial state - no cookies before Clarity starts
        const initialState = await page.evaluate(({ sessionKey, cookieKey }) => {
            const cookies = document.cookie;
            const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
            const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
            return {
                cookies,
                hasClskCookie: cookies.includes(`${sessionKey}=`),
                hasClckCookie: cookies.includes(`${cookieKey}=`),
                clskCookieValue: clskMatch ? clskMatch[1] : "",
                clckCookieValue: clckMatch ? clckMatch[1] : ""
            };
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(initialState.cookies).toBe("");
        expect(initialState.hasClskCookie).toBe(false);
        expect(initialState.hasClckCookie).toBe(false);

        // Start with track=false (implicit denied) and verify initial consent state
        const initialConsent = await page.evaluate(({ sessionKey, cookieKey }) => {
            return new Promise((resolve) => {
                (window as any).clarity("start", {
                    projectId: "test",
                    track: false,
                    upload: false
                });

                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) {
                        const cookies = document.cookie;
                        const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
                        const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
                        resolve({
                            consent,
                            hasClskCookie: cookies.includes(`${sessionKey}=`),
                            hasClckCookie: cookies.includes(`${cookieKey}=`),
                            clskCookieValue: clskMatch ? clskMatch[1] : "",
                            clckCookieValue: clckMatch ? clckMatch[1] : "",
                            clckConsentCrumb: clckMatch ? (clckMatch[1].split("^")[3] || "") : "",
                            cookies
                        });
                    }
                }, false, false, true);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(initialConsent).not.toBeNull();
        const initialResult = initialConsent as ConsentTestResult;
        expect(initialResult.consent.source).toBe(ConsentSource.Implicit);
        expect(initialResult.consent.ad_Storage).toBe(Constant.Denied);
        expect(initialResult.consent.analytics_Storage).toBe(Constant.Denied);
        // Cookies should not be set with track=false
        expect(initialResult.hasClskCookie).toBe(false);
        expect(initialResult.hasClckCookie).toBe(false);

        // Grant consent via consentv2 API
        const updatedConsent = await page.evaluate(({ sessionKey, cookieKey }) => {
            return new Promise((resolve) => {
                (window as any).clarity("consentv2", {
                    ad_Storage: "granted",
                    analytics_Storage: "granted"
                });

                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) {
                        const cookies = document.cookie;
                        const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
                        const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
                        resolve({
                            consent,
                            hasClskCookie: cookies.includes(`${sessionKey}=`),
                            hasClckCookie: cookies.includes(`${cookieKey}=`),
                            clskCookieValue: clskMatch ? clskMatch[1] : "",
                            clckCookieValue: clckMatch ? clckMatch[1] : "",
                            clckConsentCrumb: clckMatch ? (clckMatch[1].split("^")[3] || "") : "",
                            cookies
                        });
                    }
                }, false, false, true);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(updatedConsent).not.toBeNull();
        const updatedResult = updatedConsent as ConsentTestResult;
        expect(updatedResult.consent.source).toBe(ConsentSource.APIv2);
        expect(updatedResult.consent.ad_Storage).toBe(Constant.Granted);
        expect(updatedResult.consent.analytics_Storage).toBe(Constant.Granted);
        // Verify cookies are set when consent is granted
        expect(updatedResult.hasClskCookie).toBe(true);
        expect(updatedResult.hasClckCookie).toBe(true);
        expect(updatedResult.clskCookieValue).not.toBe("");
        expect(updatedResult.clckCookieValue).not.toBe("");
    });

    // ========================
    // track=true tests
    // ========================

    test("implicit granted: track=true results in granted consent", async ({ page }) => {
        await page.evaluate(setupCookieMock as () => void);

        // Verify initial state - no cookies before Clarity starts
        const initialState = await page.evaluate(({ sessionKey, cookieKey }) => {
            const cookies = document.cookie;
            const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
            const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
            return {
                cookies,
                hasClskCookie: cookies.includes(`${sessionKey}=`),
                hasClckCookie: cookies.includes(`${cookieKey}=`),
                clskCookieValue: clskMatch ? clskMatch[1] : "",
                clckCookieValue: clckMatch ? clckMatch[1] : ""
            };
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(initialState.cookies).toBe("");
        expect(initialState.hasClskCookie).toBe(false);
        expect(initialState.hasClckCookie).toBe(false);

        // Start clarity with track=true (implicit granted consent)
        const result = await page.evaluate(({ sessionKey, cookieKey }) => {
            return new Promise((resolve) => {
                (window as any).clarity("start", {
                    projectId: "test",
                    track: true,
                    upload: false
                });

                // Register metadata callback
                // wait=false (don't wait for data), recall=true (resend on changes), consentInfo=true (include consent)
                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) {
                        const cookies = document.cookie;
                        const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
                        const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
                        resolve({
                            consent,
                            hasClskCookie: cookies.includes(`${sessionKey}=`),
                            hasClckCookie: cookies.includes(`${cookieKey}=`),
                            clskCookieValue: clskMatch ? clskMatch[1] : "",
                            clckCookieValue: clckMatch ? clckMatch[1] : "",
                            clckConsentCrumb: clckMatch ? (clckMatch[1].split("^")[3] || "") : "",
                            cookies
                        });
                    }
                }, false, true, true);

                // Timeout fallback
                setTimeout(() => {
                    const cookies = document.cookie;
                    resolve({
                        consent: null,
                        hasClskCookie: cookies.includes(`${sessionKey}=`),
                        hasClckCookie: cookies.includes(`${cookieKey}=`),
                        clskCookieValue: "",
                        clckCookieValue: "",
                        cookies
                    });
                }, (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(result).not.toBeNull();
        const consentResult = result as ConsentTestResult;
        expect(consentResult.consent).not.toBeNull();
        expect(consentResult.consent.source).toBe(ConsentSource.Implicit);
        expect(consentResult.consent.ad_Storage).toBe(Constant.Granted);
        expect(consentResult.consent.analytics_Storage).toBe(Constant.Granted);
        // With track=true, _clck cookie should be set
        expect(consentResult.hasClckCookie).toBe(true);
        expect(consentResult.clckCookieValue).not.toBe("");
    });

    test("consentv2 revokes consent: track=true → denied/denied deletes cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock as () => void);

        // Verify initial state - no cookies before Clarity starts
        const initialState = await page.evaluate(({ sessionKey, cookieKey }) => {
            const cookies = document.cookie;
            const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
            const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
            return {
                cookies,
                hasClskCookie: cookies.includes(`${sessionKey}=`),
                hasClckCookie: cookies.includes(`${cookieKey}=`),
                clskCookieValue: clskMatch ? clskMatch[1] : "",
                clckCookieValue: clckMatch ? clckMatch[1] : ""
            };
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(initialState.cookies).toBe("");
        expect(initialState.hasClskCookie).toBe(false);
        expect(initialState.hasClckCookie).toBe(false);

        // Step 1: Start with track=true and verify initial granted state with cookies
        const initialConsent = await page.evaluate(({ sessionKey, cookieKey }) => {
            return new Promise((resolve) => {
                (window as any).clarity("start", {
                    projectId: "test",
                    track: true,
                    upload: false
                });

                // Get initial consent state
                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) {
                        const cookies = document.cookie;
                        const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
                        const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
                        resolve({
                            consent,
                            hasClskCookie: cookies.includes(`${sessionKey}=`),
                            hasClckCookie: cookies.includes(`${cookieKey}=`),
                            clskCookieValue: clskMatch ? clskMatch[1] : "",
                            clckCookieValue: clckMatch ? clckMatch[1] : "",
                            clckConsentCrumb: clckMatch ? (clckMatch[1].split("^")[3] || "") : "",
                            cookies
                        });
                    }
                }, false, false, true);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        // Verify initial state: implicit granted with cookies
        expect(initialConsent).not.toBeNull();
        const initialResult = initialConsent as ConsentTestResult;
        expect(initialResult.consent.source).toBe(ConsentSource.Implicit);
        expect(initialResult.consent.ad_Storage).toBe(Constant.Granted);
        expect(initialResult.consent.analytics_Storage).toBe(Constant.Granted);
        expect(initialResult.hasClckCookie).toBe(true);

        // Step 2: Call consentv2 API to deny consent and verify cookies are deleted
        const updatedConsent = await page.evaluate(({ sessionKey, cookieKey }) => {
            return new Promise((resolve) => {
                (window as any).clarity("consentv2", {
                    ad_Storage: "denied",
                    analytics_Storage: "denied"
                });

                // Get updated consent state and cookie status
                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) {
                        const cookies = document.cookie;
                        const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
                        const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
                        resolve({
                            consent,
                            hasClskCookie: cookies.includes(`${sessionKey}=`),
                            hasClckCookie: cookies.includes(`${cookieKey}=`),
                            clskCookieValue: clskMatch ? clskMatch[1] : "",
                            clckCookieValue: clckMatch ? clckMatch[1] : "",
                            clckConsentCrumb: clckMatch ? (clckMatch[1].split("^")[3] || "") : "",
                            cookies
                        });
                    }
                }, false, false, true);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        // Verify updated state: explicit denied with cookies deleted
        expect(updatedConsent).not.toBeNull();
        const updatedResult = updatedConsent as ConsentTestResult;
        expect(updatedResult.consent.source).toBe(ConsentSource.APIv2);
        expect(updatedResult.consent.ad_Storage).toBe(Constant.Denied);
        expect(updatedResult.consent.analytics_Storage).toBe(Constant.Denied);

        // Verify both cookies are deleted after consent is denied
        expect(updatedResult.hasClskCookie).toBe(false);
        expect(updatedResult.hasClckCookie).toBe(false);
    });

    test("consentv2 mixed consent: track=true → granted analytics, denied ads keeps cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock as () => void);

        // Verify initial state - no cookies before Clarity starts
        const initialState = await page.evaluate(({ sessionKey, cookieKey }) => {
            const cookies = document.cookie;
            const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
            const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
            return {
                cookies,
                hasClskCookie: cookies.includes(`${sessionKey}=`),
                hasClckCookie: cookies.includes(`${cookieKey}=`),
                clskCookieValue: clskMatch ? clskMatch[1] : "",
                clckCookieValue: clckMatch ? clckMatch[1] : ""
            };
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(initialState.cookies).toBe("");
        expect(initialState.hasClskCookie).toBe(false);
        expect(initialState.hasClckCookie).toBe(false);

        const result = await page.evaluate(({ sessionKey, cookieKey }) => {
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
                        const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
                        const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
                        resolve({
                            consent,
                            hasClskCookie: cookies.includes(`${sessionKey}=`),
                            hasClckCookie: cookies.includes(`${cookieKey}=`),
                            clskCookieValue: clskMatch ? clskMatch[1] : "",
                            clckCookieValue: clckMatch ? clckMatch[1] : "",
                            clckConsentCrumb: clckMatch ? (clckMatch[1].split("^")[3] || "") : "",
                            cookies
                        });
                    }
                }, false, false, true);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(result).not.toBeNull();
        const consentResult = result as ConsentTestResult;
        expect(consentResult.consent.source).toBe(ConsentSource.APIv2);
        expect(consentResult.consent.ad_Storage).toBe(Constant.Denied);
        expect(consentResult.consent.analytics_Storage).toBe(Constant.Granted);
        // Verify cookies remain when analytics is granted (even if ads is denied)
        expect(consentResult.hasClskCookie).toBe(true);
        expect(consentResult.hasClckCookie).toBe(true);
        expect(consentResult.clskCookieValue).not.toBe("");
        expect(consentResult.clckCookieValue).not.toBe("");
    });

    test("consentv2 mixed consent: track=true → denied analytics, granted ads deletes cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock as () => void);

        // Verify initial state - no cookies before Clarity starts
        const initialState = await page.evaluate(({ sessionKey, cookieKey }) => {
            const cookies = document.cookie;
            const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
            const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
            return {
                cookies,
                hasClskCookie: cookies.includes(`${sessionKey}=`),
                hasClckCookie: cookies.includes(`${cookieKey}=`),
                clskCookieValue: clskMatch ? clskMatch[1] : "",
                clckCookieValue: clckMatch ? clckMatch[1] : ""
            };
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(initialState.cookies).toBe("");
        expect(initialState.hasClskCookie).toBe(false);
        expect(initialState.hasClckCookie).toBe(false);

        // Start with track=true, then deny analytics but grant ads
        const result = await page.evaluate(({ sessionKey, cookieKey }) => {
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
                            const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
                            const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
                            resolve({
                                consent,
                                hasClskCookie: cookies.includes(`${sessionKey}=`),
                                hasClckCookie: cookies.includes(`${cookieKey}=`),
                                clskCookieValue: clskMatch ? clskMatch[1] : "",
                                clckCookieValue: clckMatch ? clckMatch[1] : "",
                                clckConsentCrumb: clckMatch ? (clckMatch[1].split("^")[3] || "") : "",
                                cookies
                            });
                        }
                    }, false, false, true);
                }, (window as any).COOKIE_SETUP_DELAY);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(result).not.toBeNull();
        const consentResult = result as ConsentTestResult;
        expect(consentResult.consent.source).toBe(ConsentSource.APIv2);
        expect(consentResult.consent.ad_Storage).toBe(Constant.Granted);
        expect(consentResult.consent.analytics_Storage).toBe(Constant.Denied);
        // Verify cookies are deleted when analytics denied (even if ads granted)
        expect(consentResult.hasClskCookie).toBe(false);
        expect(consentResult.hasClckCookie).toBe(false);
        expect(consentResult.clskCookieValue).toBe("");
        expect(consentResult.clckCookieValue).toBe("");
    });

    test("consentv2 maintains consent: track=true → granted/granted keeps cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock as () => void);

        // Verify initial state - no cookies before Clarity starts
        const initialState = await page.evaluate(({ sessionKey, cookieKey }) => {
            const cookies = document.cookie;
            const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
            const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
            return {
                cookies,
                hasClskCookie: cookies.includes(`${sessionKey}=`),
                hasClckCookie: cookies.includes(`${cookieKey}=`),
                clskCookieValue: clskMatch ? clskMatch[1] : "",
                clckCookieValue: clckMatch ? clckMatch[1] : ""
            };
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(initialState.cookies).toBe("");
        expect(initialState.hasClskCookie).toBe(false);
        expect(initialState.hasClckCookie).toBe(false);

        // Start with track=true (implicit granted)
        const initialConsent = await page.evaluate(({ sessionKey, cookieKey }) => {
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
                            const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
                            const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
                            resolve({
                                consent,
                                hasClskCookie: cookies.includes(`${sessionKey}=`),
                                hasClckCookie: cookies.includes(`${cookieKey}=`),
                                clskCookieValue: clskMatch ? clskMatch[1] : "",
                                clckCookieValue: clckMatch ? clckMatch[1] : "",
                                clckConsentCrumb: clckMatch ? (clckMatch[1].split("^")[3] || "") : "",
                                cookies
                            });
                        }
                    }, false, false, true);
                }, (window as any).COOKIE_SETUP_DELAY);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        // Verify initial state: implicit granted with cookies
        expect(initialConsent).not.toBeNull();
        const initialResult = initialConsent as ConsentTestResult;
        expect(initialResult.consent.source).toBe(ConsentSource.Implicit);
        expect(initialResult.consent.ad_Storage).toBe(Constant.Granted);
        expect(initialResult.consent.analytics_Storage).toBe(Constant.Granted);
        // Note: _clsk cookie is only written during upload operations (metadata.save()), not during initial setup
        // With upload: false in test config, only _clck is written by track() function during initialization
        expect(initialResult.hasClckCookie).toBe(true);
        expect(initialResult.clckCookieValue).not.toBe("");

        // Explicitly grant via consentv2 API (should maintain granted state)
        const result = await page.evaluate(({ sessionKey, cookieKey }) => {
            return new Promise((resolve) => {
                (window as any).clarity("consentv2", {
                    ad_Storage: "granted",
                    analytics_Storage: "granted"
                });

                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) {
                        const cookies = document.cookie;
                        const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
                        const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
                        resolve({
                            consent,
                            hasClskCookie: cookies.includes(`${sessionKey}=`),
                            hasClckCookie: cookies.includes(`${cookieKey}=`),
                            clskCookieValue: clskMatch ? clskMatch[1] : "",
                            clckCookieValue: clckMatch ? clckMatch[1] : "",
                            clckConsentCrumb: clckMatch ? (clckMatch[1].split("^")[3] || "") : "",
                            cookies
                        });
                    }
                }, false, false, true);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(result).not.toBeNull();
        const consentResult = result as ConsentTestResult;
        expect(consentResult.consent.source).toBe(ConsentSource.APIv2);
        expect(consentResult.consent.ad_Storage).toBe(Constant.Granted);
        expect(consentResult.consent.analytics_Storage).toBe(Constant.Granted);
        // Verify _clck cookie remains set (user ID/consent preference cookie)
        // Note: _clsk is only written during upload operations, so we only check _clck in tests with upload: false
        expect(consentResult.hasClckCookie).toBe(true);
        expect(consentResult.clckCookieValue).not.toBe("");
    });

    // ========================
    // V1 Consent API tests
    // The V1 API uses clarity("consent", boolean) where true=granted, false=denied
    // It sets both ad_Storage and analytics_Storage to the same value
    // ========================

    test("consent v1: track=false → consent(true) grants consent and sets cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock as () => void);

        // Verify initial state - no cookies before Clarity starts
        const initialState = await page.evaluate(({ sessionKey, cookieKey }) => {
            const cookies = document.cookie;
            const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
            const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
            return {
                cookies,
                hasClskCookie: cookies.includes(`${sessionKey}=`),
                hasClckCookie: cookies.includes(`${cookieKey}=`),
                clskCookieValue: clskMatch ? clskMatch[1] : "",
                clckCookieValue: clckMatch ? clckMatch[1] : ""
            };
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(initialState.cookies).toBe("");
        expect(initialState.hasClskCookie).toBe(false);
        expect(initialState.hasClckCookie).toBe(false);

        // Start with track=false (implicit denied), then grant consent via V1 API
        const result = await page.evaluate(({ sessionKey, cookieKey }) => {
            return new Promise((resolve) => {
                (window as any).clarity("start", {
                    projectId: "test",
                    track: false,
                    upload: false
                });

                setTimeout(() => {
                    // V1 API: consent(true) grants both ad_Storage and analytics_Storage
                    (window as any).clarity("consent", true);

                    (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                        if (consent) {
                            const cookies = document.cookie;
                            const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
                            const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
                            resolve({
                                consent,
                                hasClskCookie: cookies.includes(`${sessionKey}=`),
                                hasClckCookie: cookies.includes(`${cookieKey}=`),
                                clskCookieValue: clskMatch ? clskMatch[1] : "",
                                clckCookieValue: clckMatch ? clckMatch[1] : "",
                                clckConsentCrumb: clckMatch ? (clckMatch[1].split("^")[3] || "") : "",
                                cookies
                            });
                        }
                    }, false, false, true);
                }, (window as any).COOKIE_SETUP_DELAY);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(result).not.toBeNull();
        const consentResult = result as ConsentTestResult;
        expect(consentResult.consent.source).toBe(ConsentSource.APIv1);
        expect(consentResult.consent.ad_Storage).toBe(Constant.Granted);
        expect(consentResult.consent.analytics_Storage).toBe(Constant.Granted);
        // Verify cookies are set when consent is granted via V1 API
        expect(consentResult.hasClckCookie).toBe(true);
        expect(consentResult.clckCookieValue).not.toBe("");
    });

    test("consent v1: track=true → consent(false) revokes consent and deletes cookies", async ({ page }) => {
        await page.evaluate(setupCookieMock as () => void);

        // Verify initial state - no cookies before Clarity starts
        const initialState = await page.evaluate(({ sessionKey, cookieKey }) => {
            const cookies = document.cookie;
            const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
            const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
            return {
                cookies,
                hasClskCookie: cookies.includes(`${sessionKey}=`),
                hasClckCookie: cookies.includes(`${cookieKey}=`),
                clskCookieValue: clskMatch ? clskMatch[1] : "",
                clckCookieValue: clckMatch ? clckMatch[1] : ""
            };
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(initialState.cookies).toBe("");
        expect(initialState.hasClskCookie).toBe(false);
        expect(initialState.hasClckCookie).toBe(false);

        // Start with track=true (implicit granted) and verify initial state
        const initialConsent = await page.evaluate(({ sessionKey, cookieKey }) => {
            return new Promise((resolve) => {
                (window as any).clarity("start", {
                    projectId: "test",
                    track: true,
                    upload: false
                });

                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) {
                        const cookies = document.cookie;
                        const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
                        const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
                        resolve({
                            consent,
                            hasClskCookie: cookies.includes(`${sessionKey}=`),
                            hasClckCookie: cookies.includes(`${cookieKey}=`),
                            clskCookieValue: clskMatch ? clskMatch[1] : "",
                            clckCookieValue: clckMatch ? clckMatch[1] : "",
                            clckConsentCrumb: clckMatch ? (clckMatch[1].split("^")[3] || "") : "",
                            cookies
                        });
                    }
                }, false, false, true);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        // Verify initial state: implicit granted with cookies
        expect(initialConsent).not.toBeNull();
        const initialResult = initialConsent as ConsentTestResult;
        expect(initialResult.consent.source).toBe(ConsentSource.Implicit);
        expect(initialResult.consent.ad_Storage).toBe(Constant.Granted);
        expect(initialResult.consent.analytics_Storage).toBe(Constant.Granted);
        expect(initialResult.hasClckCookie).toBe(true);

        // Revoke consent via V1 API
        const result = await page.evaluate(({ sessionKey, cookieKey }) => {
            return new Promise((resolve) => {
                // V1 API: consent(false) denies both ad_Storage and analytics_Storage
                (window as any).clarity("consent", false);

                (window as any).clarity("metadata", (_data: any, _upgrade: any, consent: any) => {
                    if (consent) {
                        const cookies = document.cookie;
                        const clskMatch = cookies.match(new RegExp(`${sessionKey}=([^;]+)`));
                        const clckMatch = cookies.match(new RegExp(`${cookieKey}=([^;]+)`));
                        resolve({
                            consent,
                            hasClskCookie: cookies.includes(`${sessionKey}=`),
                            hasClckCookie: cookies.includes(`${cookieKey}=`),
                            clskCookieValue: clskMatch ? clskMatch[1] : "",
                            clckCookieValue: clckMatch ? clckMatch[1] : "",
                            clckConsentCrumb: clckMatch ? (clckMatch[1].split("^")[3] || "") : "",
                            cookies
                        });
                    }
                }, false, false, true);

                setTimeout(() => resolve(null), (window as any).CONSENT_CALLBACK_TIMEOUT);
            });
        }, { sessionKey: Constant.SessionKey, cookieKey: Constant.CookieKey });

        expect(result).not.toBeNull();
        const consentResult = result as ConsentTestResult;
        expect(consentResult.consent.source).toBe(ConsentSource.APIv1);
        expect(consentResult.consent.ad_Storage).toBe(Constant.Denied);
        expect(consentResult.consent.analytics_Storage).toBe(Constant.Denied);
        // Verify cookies are deleted when consent is revoked via V1 API
        expect(consentResult.hasClskCookie).toBe(false);
        expect(consentResult.hasClckCookie).toBe(false);
        expect(consentResult.clskCookieValue).toBe("");
        expect(consentResult.clckCookieValue).toBe("");
    });

    // ========================
    // Config cookies tests
    // ========================

    interface ConfigCookieTestOptions {
        track: boolean;
        grantConsentAfterStart?: boolean;
        denyConsentAfterStart?: boolean;
    }

    interface ConfigCookieTestResult {
        containsCookieValue: boolean;
        beforeChangeContainsCookie?: boolean;
        afterChangeContainsCookie?: boolean;
    }

    /**
     * Helper to run config cookie tests with consistent setup.
     * Sets up cookie mock with marketing_id=abc123 and returns whether the cookie value appears in payloads.
     */
    async function runConfigCookieTest(page: any, options: ConfigCookieTestOptions): Promise<ConfigCookieTestResult> {
        // Set up cookie mock with initial marketing cookie before evaluating test logic
        await page.evaluate(setupCookieMock as (initialValue: string) => void, "marketing_id=abc123");

        const result = await page.evaluate((opts: ConfigCookieTestOptions) => {

            return new Promise((resolve) => {
                const payloadsBefore: string[] = [];
                const payloadsAfter: string[] = [];
                let phase = "before";

                (window as any).clarity("start", {
                    projectId: "test",
                    track: opts.track,
                    cookies: ["marketing_id"],
                    upload: (payload: string) => {
                        if (phase === "before") {
                            payloadsBefore.push(payload);
                        } else {
                            payloadsAfter.push(payload);
                        }
                    }
                });

                const hasConsentChange = opts.grantConsentAfterStart || opts.denyConsentAfterStart;
                // For denial tests, use longer delay to ensure initial upload completes before denial
                const consentChangeDelay = opts.denyConsentAfterStart
                    ? (window as any).CONSENT_CALLBACK_TIMEOUT / 2
                    : (window as any).COOKIE_SETUP_DELAY;

                if (hasConsentChange) {
                    setTimeout(() => {
                        phase = "after";
                        const adStorage = opts.grantConsentAfterStart ? "granted" : "denied";
                        const analyticsStorage = opts.grantConsentAfterStart ? "granted" : "denied";
                        (window as any).clarity("consentv2", { ad_Storage: adStorage, analytics_Storage: analyticsStorage });
                    }, consentChangeDelay);
                }

                // For denial tests, wait longer to allow for restart
                const totalTimeout = opts.denyConsentAfterStart
                    ? consentChangeDelay + (window as any).CONSENT_CALLBACK_TIMEOUT
                    : (window as any).CONSENT_CALLBACK_TIMEOUT;

                setTimeout(() => {
                    const allPayloads = [...payloadsBefore, ...payloadsAfter].join("");
                    resolve({
                        containsCookieValue: allPayloads.includes("abc123"),
                        beforeChangeContainsCookie: payloadsBefore.join("").includes("abc123"),
                        afterChangeContainsCookie: payloadsAfter.join("").includes("abc123")
                    });
                }, totalTimeout);
            });
        }, options);

        return result as ConfigCookieTestResult;
    }

    test("config cookies: track=true logs config cookies as variables", async ({ page }) => {
        const result = await runConfigCookieTest(page, { track: true });
        expect(result.containsCookieValue).toBe(true);
    });

    test("config cookies: track=false does not log config cookies", async ({ page }) => {
        const result = await runConfigCookieTest(page, { track: false });
        expect(result.containsCookieValue).toBe(false);
    });

    test("config cookies: track=false then consentv2 grants consent logs config cookies", async ({ page }) => {
        const result = await runConfigCookieTest(page, { track: false, grantConsentAfterStart: true });
        expect(result.containsCookieValue).toBe(true);
    });

    test("config cookies: track=true then consentv2 denies consent does not log cookies after restart", async ({ page }) => {
        const result = await runConfigCookieTest(page, { track: true, denyConsentAfterStart: true });
        // Before denial, cookies should be logged (track=true, implicit granted)
        expect(result.beforeChangeContainsCookie).toBe(true);
        // After restart with denied consent, cookies should NOT be logged
        expect(result.afterChangeContainsCookie).toBe(false);
    });
});
