import { test, expect } from '@playwright/test';
import { markup } from './helper';
import { decode } from 'clarity-decode';

test.describe('BFCache Tests', () => {
    test('should log BFCache diagnostic event when pageshow fires with persisted=true', async ({ page }) => {
        // Load the test page and get initial payloads
        await markup(page, "core.html");
        
        // Stop Clarity to simulate pagehide behavior
        await page.evaluate(() => {
            window.clarity('stop');
        });

        // Record the current payload count
        const initialCount = await page.evaluate('window.payloads.length') as number;
        
        // Simulate bfcache restoration by dispatching a pageshow event with persisted=true
        await page.evaluate(() => {
            const event = new PageTransitionEvent('pageshow', { persisted: true });
            window.dispatchEvent(event);
        });

        // Wait for at least one new payload to be added after the bfcache event
        await page.waitForFunction(
            (count) => window.payloads && window.payloads.length > count,
            initialCount,
            { timeout: 5000 }
        );

        // Get all payloads including the new one
        const allPayloads = await page.evaluate('window.payloads') as string[];
        const decoded = allPayloads.map((x: string) => decode(x));
        
        // Look for diagnostic log with BFCache code (11)
        let foundBFCacheLog = false;
        for (const payload of decoded) {
            if (payload.log) {
                for (const log of payload.log) {
                    if (log.data?.code === 11) { // Code.BFCache = 11
                        foundBFCacheLog = true;
                        expect(log.data.severity).toBe(0); // Severity.Info = 0
                    }
                }
            }
        }

        expect(foundBFCacheLog).toBe(true);
    });
});
