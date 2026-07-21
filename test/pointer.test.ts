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
        sourcePointerInfo: { x: number; y: number; pressure: number; width: number; height: number };
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

async function decodePayloads(page: Page): Promise<Data.DecodedPayload[]> {
    await page.waitForTimeout(200);
    await page.evaluate(() => window.clarity("stop"));
    await page.waitForFunction("payloads && payloads.length > 0");
    const payloads: string[] = await page.evaluate(() => window.payloads);
    return payloads.map(payload => decode(payload));
}

function getPointerInfoEvents(decoded: Data.DecodedPayload[]): any[] {
    return decoded.flatMap(payload => payload.pointerInfo || []);
}

function getPointerEvents(decoded: Data.DecodedPayload[]): any[] {
    return decoded.flatMap(payload => payload.pointer || []);
}

for (const diagnostics of [false, true]) {
    test(`should emit standalone mouse info with diagnostics ${diagnostics}`, async ({ page }) => {
        await setupPage(page, 'clarity.min.js', { diagnostics });

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
            window.sourcePointerInfo = {
                x: pointerEvent.pageX,
                y: pointerEvent.pageY,
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

        const decoded = await decodePayloads(page);
        const info = getPointerInfoEvents(decoded);
        const pointers = getPointerEvents(decoded);
        const down = pointers.find(pointer => pointer.event === 13);
        const source = await page.evaluate(() => window.sourcePointerInfo);

        expect(info).toHaveLength(1);
        expect(info[0].data.pointerType).toBe(1);
        expect(info[0].data.x).toBe(source.x);
        expect(info[0].data.y).toBe(source.y);
        expect(info[0].data.pressure).toBe(source.pressure);
        expect(info[0].data.width).toBe(source.width);
        expect(info[0].data.height).toBe(source.height);
        expect(down).toBeTruthy();
        expect('pressure' in down.data).toBe(false);
        expect('width' in down.data).toBe(false);
        expect('height' in down.data).toBe(false);
    });
}

test('should emit standalone primary touch info', async ({ page }) => {
    await setupPage(page, 'clarity.min.js');

    await page.evaluate(() => {
        const child = document.getElementById('child');
        child.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            pointerType: 'touch',
            isPrimary: true,
            pressure: 0.7654321,
            width: 23.456789,
            height: 34.567891,
            clientX: 10,
            clientY: 20
        }));
    });

    const info = getPointerInfoEvents(await decodePayloads(page));

    expect(info).toHaveLength(1);
    expect(info[0].data.pointerType).toBe(2);
    expect(info[0].data.x).toBe(10);
    expect(info[0].data.y).toBe(20);
    expect(info[0].data.pressure).toBeCloseTo(0.7654321, 7);
    expect(info[0].data.width).toBe(23.456789);
    expect(info[0].data.height).toBe(34.567891);
});

test('should ignore non-primary touch info', async ({ page }) => {
    await setupPage(page, 'clarity.min.js');

    await page.evaluate(() => {
        document.getElementById('child').dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            pointerType: 'touch',
            isPrimary: false,
            pressure: 0.5,
            width: 20,
            height: 30
        }));
    });

    expect(getPointerInfoEvents(await decodePayloads(page))).toHaveLength(0);
});

test('should emit standalone primary pen info', async ({ page }) => {
    await setupPage(page, 'clarity.min.js');

    await page.evaluate(() => {
        document.getElementById('child').dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            pointerType: 'pen',
            isPrimary: true,
            pressure: 0.8,
            width: 4,
            height: 5
        }));
    });

    const info = getPointerInfoEvents(await decodePayloads(page));

    expect(info).toHaveLength(1);
    expect(info[0].data.pointerType).toBe(3);
    expect(info[0].data.pressure).toBeCloseTo(0.8, 7);
    expect(info[0].data.width).toBe(4);
    expect(info[0].data.height).toBe(5);
});

test('should emit standalone pointer info in the extended build', async ({ page }) => {
    await setupPage(page, 'clarity.extended.js');

    await page.evaluate(() => {
        document.getElementById('child').dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            pointerType: 'touch',
            isPrimary: true,
            pressure: 0.7,
            width: 20,
            height: 30
        }));
    });

    const info = getPointerInfoEvents(await decodePayloads(page));

    expect(info).toHaveLength(1);
    expect(info[0].data.pointerType).toBe(2);
    expect(info[0].data.pressure).toBeCloseTo(0.7, 7);
    expect(info[0].data.width).toBe(20);
    expect(info[0].data.height).toBe(30);
});
