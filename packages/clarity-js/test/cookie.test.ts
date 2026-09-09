import { BrowserContext, Cookie, expect, Frame, test } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

const clarityJsPath = join(__dirname, "../build/clarity.min.js");

interface Metadata {
    userId: string;
    sessionId: string;
    pageNum: number;
}

test.use({ launchOptions: { args: ["--test-third-party-cookie-phaseout"] } });

test.describe("cookie persistence", () => {
    test.beforeEach(async ({ page }) => {
        await page.route("https://parent.test/**", route => route.fulfill({
            contentType: "text/html",
            body: "<!DOCTYPE html><html><body><iframe src='https://iframe.test/'></iframe></body></html>",
        }));
        await page.route("https://iframe.test/**", route => route.fulfill({
            contentType: "text/html",
            body: "<!DOCTYPE html><html><body></body></html>",
        }));
        await page.route("https://top.test/**", route => route.fulfill({
            contentType: "text/html",
            body: "<!DOCTYPE html><html><body></body></html>",
        }));
    });

    test("persists partitioned identity across iframe reload and SPA restart", async ({ context, page }) => {
        await page.goto("https://parent.test/");
        const frame = page.frames().find(x => x.url() === "https://iframe.test/");
        if (!frame) {
            throw new Error("Cross-site iframe did not load");
        }

        await startClarity(frame);
        await expect.poll(() => getCookie(context, "https://iframe.test/", "_clsk")).not.toBeNull();
        const first = await getMetadata(frame);
        const cookies = await context.cookies("https://iframe.test/");
        const userCookie = cookies.find(x => x.name === "_clck");
        const sessionCookie = cookies.find(x => x.name === "_clsk");

        expect(userCookie?.secure).toBe(true);
        expect(userCookie?.sameSite).toBe("None");
        expect(userCookie?.partitionKey).toBe("https://parent.test");
        expect(sessionCookie?.secure).toBe(true);
        expect(sessionCookie?.sameSite).toBe("None");
        expect(sessionCookie?.partitionKey).toBe("https://parent.test");

        await frame.goto("https://iframe.test/reloaded");
        await startClarity(frame);
        const reloaded = await getMetadata(frame);
        expect(reloaded.userId).toBe(first.userId);
        expect(reloaded.sessionId).toBe(first.sessionId);
        expect(reloaded.pageNum).toBe(2);

        await frame.evaluate(() => history.pushState({}, "", "/route-2"));
        await expect.poll(() => getMetadata(frame).then(x => x.pageNum)).toBe(3);
        const restarted = await getMetadata(frame);
        expect(restarted.userId).toBe(first.userId);
        expect(restarted.sessionId).toBe(first.sessionId);

        await frame.evaluate(() => {
            (window as any).clarity("consentv2", {
                ad_Storage: "denied",
                analytics_Storage: "denied",
            });
        });
        await expect.poll(() => getCookie(context, "https://iframe.test/", "_clck")).toBeNull();
        await expect.poll(() => getCookie(context, "https://iframe.test/", "_clsk")).toBeNull();
    });

    test("keeps top-level cookies unpartitioned", async ({ context, page }) => {
        await page.goto("https://top.test/");
        await startClarity(page.mainFrame());
        await expect.poll(() => getCookie(context, "https://top.test/", "_clsk")).not.toBeNull();

        const cookies = await context.cookies("https://top.test/");
        expect(cookies.find(x => x.name === "_clck")?.partitionKey).toBeUndefined();
        expect(cookies.find(x => x.name === "_clsk")?.partitionKey).toBeUndefined();
    });
});

async function startClarity(frame: Frame): Promise<void> {
    await frame.addScriptTag({ content: readFileSync(clarityJsPath, "utf-8") });
    await frame.evaluate(() => {
        (window as any).clarity("start", {
            projectId: "test",
            track: true,
            delay: 1,
            restart: 0,
            upload: () => undefined,
        });
    });
}

async function getMetadata(frame: Frame): Promise<Metadata> {
    return frame.evaluate(() => new Promise<Metadata>(resolve => {
        (window as any).clarity("metadata", resolve, false);
    }));
}

async function getCookie(context: BrowserContext, url: string, name: string): Promise<Cookie | null> {
    return (await context.cookies(url)).find(x => x.name === name) || null;
}
