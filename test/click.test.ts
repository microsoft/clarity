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

async function setupPage(page: Page, options: Record<string, any> = {}, bundle: string = "clarity.min.js"): Promise<void> {
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
          ${readFileSync(resolve(__dirname, `../packages/clarity-js/build/${bundle}`), 'utf8')};
          clarity("start", {
            ...${configOptions},
            "upload": (payload) => { window.payloads.push(payload); }
          });
        </script>
        </body>
    `));
}

function getClicks(decoded: Data.DecodedPayload[]): any[] {
    const clicks: any[] = [];
    for (const payload of decoded) {
        if (payload.click) {
            clicks.push(...payload.click);
        }
    }
    return clicks;
}

test.describe('Click Source Detection', () => {
    test('should set source to Undefined (0) for trusted user clicks', async ({ page }) => {
        await setupPage(page);

        await page.click("#child");
        
        await page.waitForTimeout(200);
        await page.waitForFunction("payloads && payloads.length > 0");

        const payloads: string[] = await page.evaluate('payloads');
        const decoded = payloads.map(x => decode(x));
        const clicks = getClicks(decoded);

        expect(clicks.length).toBeGreaterThan(0);
        expect(clicks[0].data.source).toBe(0);
    });

    test('should set source to FirstParty (1) or Eval (3) for same-origin script clicks', async ({ page }) => {
        await setupPage(page, { diagnostics: true });

        await page.evaluate(() => {
            const script = document.createElement('script');
            script.textContent = 'document.getElementById("child").click();';
            document.body.appendChild(script);
        });
        
        await page.waitForTimeout(200);
        await page.waitForFunction("payloads && payloads.length > 0");

        const payloads: string[] = await page.evaluate('payloads');
        const decoded = payloads.map(x => decode(x));
        const clicks = getClicks(decoded);

        expect(clicks.length).toBeGreaterThan(0);
        expect([1, 3]).toContain(clicks[0].data.source);
    });

    test('should set source to Eval (3) for clicks triggered via eval', async ({ page }) => {
        await setupPage(page, { diagnostics: true });

        await page.evaluate(() => {
            const script = document.createElement('script');
            script.textContent = 'eval(\'document.getElementById("child").click()\')';
            document.body.appendChild(script);
        });
        
        await page.waitForTimeout(200);
        await page.waitForFunction("payloads && payloads.length > 0");

        const payloads: string[] = await page.evaluate('payloads');
        const decoded = payloads.map(x => decode(x));
        const clicks = getClicks(decoded);

        expect(clicks.length).toBeGreaterThan(0);
        expect(clicks[0].data.source).toBe(3);
    });

    test('should set source to Eval (3) for clicks triggered via Function constructor', async ({ page }) => {
        await setupPage(page, { diagnostics: true });

        await page.evaluate(() => {
            const script = document.createElement('script');
            script.textContent = 'new Function(\'document.getElementById("child").click()\')()';
            document.body.appendChild(script);
        });
        
        await page.waitForTimeout(200);
        await page.waitForFunction("payloads && payloads.length > 0");

        const payloads: string[] = await page.evaluate('payloads');
        const decoded = payloads.map(x => decode(x));
        const clicks = getClicks(decoded);

        expect(clicks.length).toBeGreaterThan(0);
        expect(clicks[0].data.source).toBe(3);
    });

    test('should have trust=0 for programmatic clicks and trust=1 for user clicks', async ({ page }) => {
        await setupPage(page);

        await page.evaluate(() => {
            const script = document.createElement('script');
            script.textContent = 'document.getElementById("child").click();';
            document.body.appendChild(script);
        });
        await page.waitForTimeout(200);
        await page.waitForFunction("payloads && payloads.length > 0");

        let payloads: string[] = await page.evaluate('payloads');
        let decoded = payloads.map(x => decode(x));
        let clicks = getClicks(decoded);

        expect(clicks.length).toBeGreaterThan(0);
        expect(clicks[0].data.trust).toBe(0);

        await page.evaluate(() => { window.payloads = []; });

        await page.click("#child");
        await page.waitForTimeout(200);
        await page.waitForFunction("payloads && payloads.length > 0");

        payloads = await page.evaluate('payloads');
        decoded = payloads.map(x => decode(x));
        clicks = getClicks(decoded);

        expect(clicks.length).toBeGreaterThan(0);
        expect(clicks[0].data.trust).toBe(1);
    });

    test('should preserve click detail across payload layouts', async ({ browser }) => {
        for (const [bundle, detailIndex] of [["clarity.min.js", 21], ["clarity.extended.js", 22]] as const) {
            const page = await browser.newPage();
            await setupPage(page, {}, bundle);
            await page.locator("#child").evaluate(element =>
                element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 7 })));
            await page.waitForTimeout(200);
            await page.waitForFunction("payloads && payloads.length > 0");

            const payloads: string[] = await page.evaluate('payloads');
            const encoded = payloads.map(payload => JSON.parse(payload)).find(payload => payload.a.some(event => event[1] === 9));
            const click = encoded.a.find(event => event[1] === 9);
            expect(click[detailIndex]).toBe(7);
            expect(getClicks(payloads.map(payload => decode(payload)))[0].data.detail).toBe(7);

            if (detailIndex === 21) {
                click.pop();
                expect(getClicks([decode(JSON.stringify(encoded))])[0].data.detail).toBeNull();
            } else {
                expect(typeof click[21]).toBe("string");
            }

            await page.close();
        }
    });
});
