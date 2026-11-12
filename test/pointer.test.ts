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
        sourcePointerDown: { x: number; y: number; id: number; pressure: number; width: number; height: number };
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

function getPointerDownEvents(decoded: Data.DecodedPayload[]): any[] {
    return decoded.flatMap(payload => payload.pointerDown || []);
}

function getPointerEvents(decoded: Data.DecodedPayload[]): any[] {
    return decoded.flatMap(payload => payload.pointer || []);
}

test('should emit standalone mouse pointerdown', async ({ page }) => {
    await setupPage(page, 'clarity.min.js', { diagnostics: true });

    await page.evaluate(() => {
        const child = document.getElementById('child');
        const pointerEvent = new PointerEvent('pointerdown', {
            bubbles: true,
            pointerType: 'mouse',
            pointerId: 41,
            isPrimary: true,
            pressure: 0.123456789,
            width: 1.23456789,
            height: 78.9012345,
            clientX: 10,
            clientY: 20
        });
        window.sourcePointerDown = {
            x: pointerEvent.pageX,
            y: pointerEvent.pageY,
            id: pointerEvent.pointerId,
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
    const pointerDown = getPointerDownEvents(decoded);
    const pointers = getPointerEvents(decoded);
    const down = pointers.find(pointer => pointer.event === 13);
    const source = await page.evaluate(() => window.sourcePointerDown);

    expect(pointerDown).toHaveLength(1);
    expect(down).toBeTruthy();
    expect(pointerDown[0].data.target).toBe(down.data.target);
    expect(pointerDown[0].data.id).toBe(source.id);
    expect(pointerDown[0].data.isPrimary).toBe(true);
    expect(pointerDown[0].data.type).toBe(1);
    expect(pointerDown[0].data.x).toBe(source.x);
    expect(pointerDown[0].data.y).toBe(source.y);
    expect(pointerDown[0].data.pressure).toBeCloseTo(source.pressure, 7);
    expect(pointerDown[0].data.width).toBeCloseTo(source.width, 7);
    expect(pointerDown[0].data.height).toBeCloseTo(source.height, 7);
    expect('pressure' in down.data).toBe(false);
    expect('width' in down.data).toBe(false);
    expect('height' in down.data).toBe(false);
});

test('should preserve synthetic mouse primary state', async ({ page }) => {
    await setupPage(page, 'clarity.min.js', { diagnostics: true });

    await page.evaluate(() => {
        document.getElementById('child').dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            pointerType: 'mouse',
            pointerId: 46,
            isPrimary: false,
            pressure: 0,
            width: 1,
            height: 1
        }));
    });

    const pointerDown = getPointerDownEvents(await decodePayloads(page));

    expect(pointerDown).toHaveLength(1);
    expect(pointerDown[0].data.id).toBe(46);
    expect(pointerDown[0].data.isPrimary).toBe(false);
    expect(pointerDown[0].data.type).toBe(1);
});

test('should emit standalone primary touch pointerdown', async ({ page }) => {
    await setupPage(page, 'clarity.min.js', { diagnostics: true });

    await page.evaluate(() => {
        const child = document.getElementById('child');
        child.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            pointerType: 'touch',
            pointerId: 42,
            isPrimary: true,
            pressure: 0.7654321,
            width: 23.456789,
            height: 34.567891,
            clientX: 10,
            clientY: 20
        }));
    });

    const pointerDown = getPointerDownEvents(await decodePayloads(page));

    expect(pointerDown).toHaveLength(1);
    expect(pointerDown[0].data.target).toBeGreaterThan(0);
    expect(pointerDown[0].data.id).toBe(42);
    expect(pointerDown[0].data.isPrimary).toBe(true);
    expect(pointerDown[0].data.type).toBe(2);
    expect(pointerDown[0].data.x).toBe(10);
    expect(pointerDown[0].data.y).toBe(20);
    expect(pointerDown[0].data.pressure).toBeCloseTo(0.7654321, 7);
    expect(pointerDown[0].data.width).toBe(23.456789);
    expect(pointerDown[0].data.height).toBe(34.567891);
});

test('should emit standalone non-primary touch pointerdown', async ({ page }) => {
    await setupPage(page, 'clarity.min.js', { diagnostics: true });

    await page.evaluate(() => {
        document.getElementById('child').dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            pointerType: 'touch',
            pointerId: 43,
            isPrimary: false,
            pressure: 0.5,
            width: 20,
            height: 30
        }));
    });

    const pointerDown = getPointerDownEvents(await decodePayloads(page));

    expect(pointerDown).toHaveLength(1);
    expect(pointerDown[0].data.id).toBe(43);
    expect(pointerDown[0].data.isPrimary).toBe(false);
    expect(pointerDown[0].data.type).toBe(2);
});

test('should emit standalone primary pen pointerdown', async ({ page }) => {
    await setupPage(page, 'clarity.min.js', { diagnostics: true });

    await page.evaluate(() => {
        document.getElementById('child').dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            pointerType: 'pen',
            pointerId: 44,
            isPrimary: true,
            pressure: 0.8,
            width: 4,
            height: 5
        }));
    });

    const pointerDown = getPointerDownEvents(await decodePayloads(page));

    expect(pointerDown).toHaveLength(1);
    expect(pointerDown[0].data.id).toBe(44);
    expect(pointerDown[0].data.isPrimary).toBe(true);
    expect(pointerDown[0].data.type).toBe(3);
    expect(pointerDown[0].data.pressure).toBeCloseTo(0.8, 7);
    expect(pointerDown[0].data.width).toBe(4);
    expect(pointerDown[0].data.height).toBe(5);
});

for (const pointerType of ['', 'vendor-pointer']) {
    test(`should emit unknown pointerdown type "${pointerType}"`, async ({ page }) => {
        await setupPage(page, 'clarity.min.js', { diagnostics: true });

        await page.evaluate(type => {
            document.getElementById('child').dispatchEvent(new PointerEvent('pointerdown', {
                bubbles: true,
                pointerType: type,
                pointerId: 48,
                isPrimary: true,
                pressure: 0.4,
                width: 6,
                height: 7
            }));
        }, pointerType);

        const pointerDown = getPointerDownEvents(await decodePayloads(page));

        expect(pointerDown).toHaveLength(1);
        expect(pointerDown[0].data.id).toBe(48);
        expect(pointerDown[0].data.isPrimary).toBe(true);
        expect(pointerDown[0].data.type).toBe(0);
        expect(pointerDown[0].data.pressure).toBeCloseTo(0.4, 7);
        expect(pointerDown[0].data.width).toBe(6);
        expect(pointerDown[0].data.height).toBe(7);
    });
}

test('should preserve zero pointerdown coordinates inside an iframe', async ({ page }) => {
    await setupPage(page, 'clarity.min.js', { diagnostics: true });

    const expected = await page.evaluate(async () => {
        const frame = document.createElement('iframe');
        frame.style.position = 'absolute';
        frame.style.left = '40px';
        frame.style.top = '50px';
        frame.style.border = '0';
        frame.srcdoc = '<button id="target">target</button>';
        document.body.appendChild(frame);
        await new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
        await new Promise(resolve => setTimeout(resolve, 100));
        frame.contentDocument.getElementById('target').dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            pointerType: 'mouse',
            pointerId: 47,
            isPrimary: true,
            clientX: 0,
            clientY: 0
        }));
        const bounds = frame.getBoundingClientRect();
        return { x: Math.round(bounds.x), y: Math.round(bounds.y) };
    });

    const pointerDown = getPointerDownEvents(await decodePayloads(page));

    expect(pointerDown).toHaveLength(1);
    expect(pointerDown[0].data.x).toBe(expected.x);
    expect(pointerDown[0].data.y).toBe(expected.y);
});

test('should emit standalone pointerdown in the extended build', async ({ page }) => {
    await setupPage(page, 'clarity.extended.js', { diagnostics: true });

    await page.evaluate(() => {
        document.getElementById('child').dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            pointerType: 'touch',
            pointerId: 45,
            isPrimary: true,
            pressure: 0.7,
            width: 20,
            height: 30
        }));
    });

    const pointerDown = getPointerDownEvents(await decodePayloads(page));

    expect(pointerDown).toHaveLength(1);
    expect(pointerDown[0].data.target).toBeGreaterThan(0);
    expect(pointerDown[0].data.id).toBe(45);
    expect(pointerDown[0].data.isPrimary).toBe(true);
    expect(pointerDown[0].data.type).toBe(2);
    expect(pointerDown[0].data.pressure).toBeCloseTo(0.7, 7);
    expect(pointerDown[0].data.width).toBe(20);
    expect(pointerDown[0].data.height).toBe(30);
});

test('should not emit pointerdown when diagnostics is disabled', async ({ page }) => {
    await setupPage(page, 'clarity.min.js');

    await page.evaluate(() => {
        document.getElementById('child').dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            pointerType: 'mouse',
            pointerId: 49,
            isPrimary: true
        }));
    });

    expect(getPointerDownEvents(await decodePayloads(page))).toHaveLength(0);
});
