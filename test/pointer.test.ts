import { test, expect } from '@playwright/test';
import { decode } from 'clarity-decode';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import type { Page } from '@playwright/test';
import type { Data } from "clarity-decode";

declare global {
    interface Window {
        clarity: (method: string, ...args: any[]) => void;
        payloads: string[];
    }
}

async function setupPage(page: Page, options: Record<string, any> = {}): Promise<void> {
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
          ${readFileSync(resolve(__dirname, `../packages/clarity-js/build/clarity.min.js`), 'utf8')};
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

test.describe('Pointer pressure, width and height', () => {
    test('should record pressure, width and height on a mouse down', async ({ page }) => {
        await setupPage(page);

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
});
