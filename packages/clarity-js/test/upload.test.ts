import { expect, Page, Route, test } from "@playwright/test";
import { join } from "path";

interface Payload {
    e: (string | number)[];
    a: unknown[][];
}

declare global {
    interface Window {
        uploadClarity: (method: string, ...args: unknown[]) => void;
        uploads: Payload[];
        releases: (() => void)[];
        completions: number;
        uploadTimeout: () => void;
        onUpload?: () => void;
    }
}

type UploadWindow = Window;

async function setup(page: Page, compression: boolean = true, transport: boolean = false, delay: number = 50): Promise<void> {
    await page.goto("https://example.test");
    await page.evaluate(({ compression: supported, transport: network, delay: gap }) => {
        const w = window as UploadWindow;
        w.uploads = [];
        w.releases = [];
        w.completions = 0;
        if (!supported) {
            Reflect.deleteProperty(window, "CompressionStream");
        } else {
            const original = Response.prototype.arrayBuffer;
            Response.prototype.arrayBuffer = function(): Promise<ArrayBuffer> {
                const result = original.call(this);
                return new Promise<ArrayBuffer>((resolve, reject) => {
                    result.then(buffer => {
                        w.releases.push(() => {
                            w.completions++;
                            resolve(buffer);
                        });
                    }, reject);
                });
            };
        }
        w["clarity"] = (method: string, ...args: unknown[]): void => {
            const queued = w["clarity"] as { q?: unknown[][] };
            (queued.q = queued.q || []).push([method, ...args]);
        };
        w.uploadClarity = (method: string, ...args: unknown[]): void => w["clarity"](method, ...args);
        w.uploadClarity("start", {
            projectId: "old-project", track: false, content: false, lean: true, delay: network ? 1000 : gap,
            upload: network ? "https://example.test/collect" : (payload: string): void => {
                w.uploads.push(JSON.parse(payload) as Payload);
                if (w.onUpload) { w.onUpload(); }
            }
        });
        w.uploadClarity("event", "before-compression-started");
    }, { compression, transport, delay });
    await page.addScriptTag({ path: join(__dirname, "..", "build", "clarity.min.js") });
}

async function release(page: Page): Promise<void> {
    await page.evaluate(async () => {
        const w = window as UploadWindow;
        w.releases.splice(0).forEach(resolve => resolve());
        await new Promise(resolve => window.setTimeout(resolve, 0));
    });
}

test.describe("upload shutdown", () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("https://example.test", route => route.fulfill({
            contentType: "text/html", body: "<!doctype html><p>Upload test</p>"
        }));
    });

    test.afterEach(() => {
        expect(errors).toEqual([]);
    });

    test("flushes pending events once before the final batch without waiting for compression", async ({ page }) => {
        await setup(page);
        await expect.poll(() => page.evaluate(() => (window as UploadWindow).releases.length)).toBe(1);
        await page.evaluate(() => {
            const w = window as UploadWindow;
            w.uploadClarity("event", "after-compression-started");
            w.uploadClarity("stop");
        });
        const uploads = await page.evaluate(() => (window as UploadWindow).uploads);
        expect(uploads.map(payload => payload.e[1])).toEqual([1, 2]);
        expect(uploads.map(payload => payload.e[9])).toEqual([0, 1]);
        expect(uploads[0].a.length).toBeGreaterThan(0);
        expect(JSON.stringify(uploads[0].a)).toContain("before-compression-started");
        expect(JSON.stringify(uploads[1].a)).not.toContain("before-compression-started");
        expect(JSON.stringify(uploads[1].a)).toContain("after-compression-started");
        expect(await page.evaluate(() => (window as UploadWindow).completions)).toBe(0);
        await release(page);
        expect(await page.evaluate(() => (window as UploadWindow).uploads)).toEqual(uploads);
    });

    test("flushes multiple pending batches and cannot send them through a restarted lifecycle", async ({ page }) => {
        await setup(page);
        for (let count = 1; count <= 2; count++) {
            await expect.poll(() => page.evaluate(() => (window as UploadWindow).releases.length)).toBe(count);
            if (count === 1) {
                await page.evaluate(() => (window as UploadWindow).uploadClarity("event", "second-batch"));
            }
        }
        await page.evaluate(() => {
            const w = window as UploadWindow;
            w.uploadClarity("stop");
            w.uploadClarity("start", {
                projectId: "new-project", delay: 60000,
                upload: (payload: string): void => { w.uploads.push(JSON.parse(payload) as Payload); }
            });
        });
        const uploads = await page.evaluate(() => (window as UploadWindow).uploads);
        expect(uploads.map(payload => payload.e[1])).toEqual([1, 2, 3]);
        expect(uploads.map(payload => payload.e[9])).toEqual([0, 0, 1]);
        expect(uploads.every(payload => payload.e[4] === "old-project")).toBe(true);
        await release(page);
        expect(await page.evaluate(() => (window as UploadWindow).uploads)).toEqual(uploads);
        await page.evaluate(() => (window as UploadWindow).uploadClarity("stop"));
        const restarted = await page.evaluate(() => (window as UploadWindow).uploads[3]);
        expect(restarted.e[1]).toBe(1);
        expect(restarted.e[4]).toBe("new-project");
    });

    for (const compression of [true, false]) {
        test(`preserves normal uploads and final flush (compression=${compression})`, async ({ page }) => {
            await setup(page, compression);
            if (compression) {
                await expect.poll(() => page.evaluate(() => (window as UploadWindow).releases.length)).toBe(1);
                await release(page);
            }
            await expect.poll(() => page.evaluate(() => (window as UploadWindow).uploads.length)).toBe(1);
            await page.evaluate(() => (window as UploadWindow).uploadClarity("stop"));
            expect(await page.evaluate(() => (window as UploadWindow).uploads.map(payload => payload.e[1]))).toEqual([1, 2]);
        });
    }

    test("falls back to an uncompressed upload when compression fails", async ({ page }) => {
        await setup(page);
        await page.evaluate(() => {
            Response.prototype.arrayBuffer = (): Promise<ArrayBuffer> => Promise.reject(new Error("Compression failed"));
        });
        await expect.poll(() => page.evaluate(() => (window as UploadWindow).uploads.length)).toBe(1);
        await page.evaluate(() => (window as UploadWindow).uploadClarity("stop"));
        expect(await page.evaluate(() => (window as UploadWindow).uploads.map(payload => payload.e[1]))).toEqual([1, 2]);
    });

    for (const pending of [false, true]) {
        test(`prevents recursive stop and cancels callback timers (pending=${pending})`, async ({ page }) => {
            await setup(page, true, false, pending ? 50 : 60000);
            if (pending) {
                await expect.poll(() => page.evaluate(() => (window as UploadWindow).releases.length)).toBe(1);
            }
            const timers = await page.evaluate(gap => {
                const w = window as UploadWindow;
                const scheduled: number[] = [];
                const cancelled: number[] = [];
                const schedule = window.setTimeout;
                const cancel = window.clearTimeout;
                window.setTimeout = (...args: Parameters<typeof window.setTimeout>): number => {
                    const handle = schedule(...args);
                    if (args[1] === gap) { scheduled.push(handle); }
                    return handle;
                };
                window.clearTimeout = (handle: number): void => {
                    cancelled.push(handle);
                    cancel(handle);
                };
                w.onUpload = (): void => {
                    w.uploadClarity("event", "shutdown-callback");
                    w.uploadClarity("stop");
                };
                w.uploadClarity("stop");
                w.onUpload = undefined;
                window.setTimeout = schedule;
                window.clearTimeout = cancel;
                return { scheduled, cancelled, uploads: w.uploads };
            }, pending ? 50 : 60000);
            expect(timers.uploads.map(payload => payload.e[1])).toEqual(pending ? [1, 2] : [1]);
            expect(timers.scheduled.length).toBeGreaterThan(0);
            expect(timers.scheduled.every(handle => timers.cancelled.includes(handle))).toBe(true);
            await release(page);
            expect(await page.evaluate(() => (window as UploadWindow).uploads)).toEqual(timers.uploads);
            await page.evaluate(() => {
                const w = window as UploadWindow;
                w.uploadClarity("start", { delay: 60000 });
                w.uploadClarity("stop");
            });
            expect(await page.evaluate(() => (window as UploadWindow).uploads.length)).toBe(timers.uploads.length + 1);
        });
    }

    for (const accepted of [true, false]) {
        test(`uses beacon for pending shutdown batches with XHR fallback (accepted=${accepted})`, async ({ page }) => {
            const requests: Payload[] = [];
            await page.route("https://example.test/collect", async route => {
                requests.push(JSON.parse(route.request().postData()) as Payload);
                await route.fulfill({ status: 204 });
            });
            await setup(page, true, true);
            await page.evaluate(success => {
                const w = window as UploadWindow;
                navigator.sendBeacon = (_url: string, body: BodyInit): boolean => {
                    w.uploads.push(JSON.parse(String(body)) as Payload);
                    return success;
                };
            }, accepted);
            await expect.poll(() => page.evaluate(() => (window as UploadWindow).releases.length)).toBe(1);
            await page.evaluate(() => (window as UploadWindow).uploadClarity("stop"));
            const beacons = await page.evaluate(() => (window as UploadWindow).uploads);
            expect(beacons.map(payload => payload.e[1])).toEqual([1, 2]);
            expect(beacons.map(payload => payload.e[9])).toEqual([0, 1]);
            if (!accepted) {
                await expect.poll(() => requests.length).toBe(2);
                expect(requests).toEqual(beacons);
            }
            await release(page);
            expect(await page.evaluate(() => (window as UploadWindow).uploads)).toEqual(beacons);
            expect(requests.length).toBe(accepted ? 0 : 2);
        });
    }

    for (const status of [200, 503]) {
        test(`ignores stale XHR responses and timeouts after restart (status=${status})`, async ({ page }) => {
            const requests: Route[] = [];
            await page.route("https://example.test/collect", route => { requests.push(route); });
            await setup(page, true, true);
            await page.evaluate(() => {
                const w = window as UploadWindow;
                const original = XMLHttpRequest.prototype.send;
                XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit): void {
                    if (!w.uploadTimeout) {
                        const handler = this.ontimeout;
                        w.uploadTimeout = (): void => { handler.call(this, new ProgressEvent("timeout")); };
                    }
                    original.call(this, body);
                };
                navigator.sendBeacon = (_url: string, body: BodyInit): boolean => {
                    w.uploads.push(JSON.parse(String(body)) as Payload);
                    return true;
                };
            });
            await expect.poll(() => page.evaluate(() => (window as UploadWindow).releases.length)).toBe(1);
            await release(page);
            await expect.poll(() => requests.length).toBe(1);
            await page.evaluate(() => {
                const w = window as UploadWindow;
                w.uploadClarity("stop");
                w.uploadClarity("start", {
                    projectId: "new-project", delay: 1000, upload: "https://example.test/collect",
                    report: "https://example.test/collect"
                });
            });
            await expect.poll(() => page.evaluate(() => (window as UploadWindow).releases.length)).toBe(1);
            await release(page);
            await expect.poll(() => requests.length).toBe(2);
            await page.evaluate(() => (window as UploadWindow).uploadTimeout());
            const response = page.waitForResponse("https://example.test/collect");
            await requests[0].fulfill({ status, body: status === 200 ? "END" : "" });
            await response;
            await page.waitForTimeout(100);
            expect(await page.evaluate(() => (window as UploadWindow).uploads.length)).toBe(1);
            expect(requests.length).toBe(2);
            await page.evaluate(() => (window as UploadWindow).uploadClarity("stop"));
            expect(await page.evaluate(() => (window as UploadWindow).uploads[1].e[4])).toBe("new-project");
        });
    }

});
