import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { decode } from 'clarity-decode';

// Loads Clarity on a page whose history.pushState is already wrapped by a foreign
// script, reproducing the Chrome for iOS (CriOS) scenario where the injected wrapper
// re-dispatches through the live history.pushState. Once Clarity wraps that wrapper the
// two call each other; the re-entrancy guard must cap the depth and log
// Code.CallStackDepth instead of throwing RangeError: Maximum call stack size exceeded.
test.describe('History Tests', () => {
    test('should cap re-entrant history proxy recursion instead of overflowing the stack', async ({ page }) => {
        await page.addInitScript(() => {
            const nativePush = history.pushState;
            (window as any).__criosActive = false;
            history.pushState = function (this: History): void {
                if ((window as any).__criosActive) {
                    // Re-dispatch through the current property (Clarity's wrapper after start).
                    return (history.pushState as Function).apply(this, arguments);
                }
                return nativePush.apply(this, arguments);
            };
        });

        const htmlPath = resolve(__dirname, './html/core.html');
        const html = readFileSync(htmlPath, 'utf8');
        const clarityJs = readFileSync(resolve(__dirname, '../packages/clarity-js/build/clarity.min.js'), 'utf8');
        await page.goto(pathToFileURL(htmlPath).toString());
        await page.setContent(html.replace('</body>', `
            <script>
              window.payloads = [];
              ${clarityJs};
              clarity("start", { delay: 100, projectId: "test", upload: (p) => { window.payloads.push(p); window.clarity("upgrade", "test"); } });
            </script>
            </body>
        `));

        await page.waitForFunction('window.payloads && window.payloads.length > 0', null, { timeout: 10000 });
        const initialCount = await page.evaluate('window.payloads.length') as number;

        // Trigger the mutual recursion and confirm the page survives (no RangeError).
        const threw = await page.evaluate(() => {
            (window as any).__criosActive = true;
            try {
                history.pushState({}, "");
                return false;
            } catch (e) {
                return (e as Error)?.name === "RangeError";
            } finally {
                (window as any).__criosActive = false;
            }
        });
        expect(threw).toBe(false);

        // Diagnostic logs are queued with transmit=false, so they piggyback on the next
        // upload. Perform an interaction to flush the pending Code.CallStackDepth log.
        await page.click('#child');

        await page.waitForFunction(
            (count) => window.payloads && window.payloads.length > count,
            initialCount,
            { timeout: 10000 }
        );

        const allPayloads = await page.evaluate('window.payloads') as string[];
        const decoded = allPayloads.map((x: string) => decode(x));

        let foundCallStackLog = false;
        for (const payload of decoded) {
            if (payload.log) {
                for (const log of payload.log) {
                    if (log.data?.code === 4) { // Code.CallStackDepth = 4
                        foundCallStackLog = true;
                        expect(log.data.severity).toBe(0); // Severity.Info = 0
                    }
                }
            }
        }

        expect(foundCallStackLog).toBe(true);
    });
});
