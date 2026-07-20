import { test, expect } from '@playwright/test';
import { decode } from 'clarity-decode';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import type { Page } from '@playwright/test';
import type { Data } from 'clarity-decode';

declare global {
    interface Window {
        clarity: (method: string, ...args: any[]) => void;
        payloads: string[];
        sourcePointerGeometry: { pressure: number; width: number; height: number };
    }
}

async function setupPage(page: Page, build: string, options: Record<string, any> = {}): Promise<void> {
    const htmlPath = resolve(__dirname, `./html/core.html`);
    const htmlFileUrl = pathToFileURL(htmlPath).toString();
    const html = readFileSync(htmlPath, 'utf8');
    const configOptions = JSON.stringify({
        "delay": 100,
        "projectId": "test",
        ...options
    });
    await page.goto(htmlFileUrl);
    await page.setContent(html.replace("</body>", `
        <script>
          window.payloads = [];
          ${readFileSync(resolve(__dirname, `../packages/clarity-js/build/${build}`), 'utf8')};
          clarity("start", {
            ...${configOptions},
            "upload": (payload) => { window.payloads.push(payload); }
          });
        </script>
        </body>
    `));
}

function getPointerEvents(decoded: Data.DecodedPayload[]): any[] {
    const events: any[] = [];
    for (const payload of decoded) {
        if (payload.pointer) {
            events.push(...payload.pointer);
        }
    }
    return events;
}

for (const build of ['clarity.min.js']) {
    test.describe(`Pointer pressure, width and height in ${build}`, () => {
        test('should record pressure, width and height by default', async ({ page }) => {
            await setupPage(page, build);

            const box = await page.locator('#child').boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.up();

            await page.waitForTimeout(200);
            await page.waitForFunction("payloads && payloads.length > 0");

            const payloads: string[] = await page.evaluate('payloads');
            const decoded = payloads.map(x => decode(x));
            const pointers = getPointerEvents(decoded);

            const down = pointers.find(p => p.event === 13);
            expect(down).toBeTruthy();
            expect(typeof down.data.pressure).toBe('number');
            expect(down.data.pressure).toBeCloseTo(0.5, 2);
            expect(typeof down.data.width).toBe('number');
            expect(typeof down.data.height).toBe('number');
        });

        test('should record the same geometry when diagnostics are enabled', async ({ page }) => {
            await setupPage(page, build, { diagnostics: true });

            const box = await page.locator('#child').boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.up();

            await page.waitForTimeout(200);
            await page.waitForFunction("payloads && payloads.length > 0");

            const payloads: string[] = await page.evaluate('payloads');
            const decoded = payloads.map(x => decode(x));
            const pointers = getPointerEvents(decoded);

            const down = pointers.find(p => p.event === 13);
            expect(down).toBeTruthy();
            expect(typeof down.data.pressure).toBe('number');
            expect(down.data.pressure).toBeCloseTo(0.5, 2);
            expect(typeof down.data.width).toBe('number');
            expect(typeof down.data.height).toBe('number');
        });

        test('should preserve pointer geometry without client-side rounding', async ({ page }) => {
            await setupPage(page, build, { diagnostics: true });

            await page.evaluate(() => {
                const child = document.getElementById('child');
                const pointerEvent = new PointerEvent('pointerdown', {
                    bubbles: true,
                    pointerType: 'mouse',
                    pressure: 0.123456789,
                    width: 1.23456789,
                    height: 78.9012345,
                    clientX: 10,
                    clientY: 20
                });
                window.sourcePointerGeometry = {
                    pressure: pointerEvent.pressure,
                    width: pointerEvent.width,
                    height: pointerEvent.height
                };
                child.dispatchEvent(pointerEvent);
                child.dispatchEvent(new MouseEvent('mousedown', {
                    bubbles: true,
                    clientX: 10,
                    clientY: 20
                }));
            });

            await page.waitForTimeout(200);
            await page.waitForFunction("payloads && payloads.length > 0");

            const payloads: string[] = await page.evaluate('payloads');
            const source = await page.evaluate(() => window.sourcePointerGeometry);
            const decoded = payloads.map(x => decode(x));
            const pointers = getPointerEvents(decoded);
            const down = pointers.find(p => p.event === 13);

            expect(down.data.pressure).toBe(source.pressure);
            expect(down.data.width).toBe(source.width);
            expect(down.data.height).toBe(source.height);
        });
    });
}

test('should leave the extended encoder unchanged', async ({ page }) => {
    await setupPage(page, 'clarity.extended.js', { diagnostics: true });

    const box = await page.locator('#child').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();

    await page.waitForTimeout(200);
    await page.waitForFunction("payloads && payloads.length > 0");

    const payloads: string[] = await page.evaluate('payloads');
    const decoded = payloads.map(x => decode(x));
    const pointers = getPointerEvents(decoded);
    const down = pointers.find(p => p.event === 13);

    expect(down).toBeTruthy();
    expect('pressure' in down.data).toBe(false);
    expect('width' in down.data).toBe(false);
    expect('height' in down.data).toBe(false);
});
