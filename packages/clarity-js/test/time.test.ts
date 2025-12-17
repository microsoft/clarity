import { expect, test } from "@playwright/test";
import { start, stop, time } from "@src/core/time";

test.describe("Time Utilities", () => {
    test("time module should start and stop", () => {
        start();
        const time1 = time();

        expect(time1).toBeGreaterThanOrEqual(0);

        stop();
        const time2 = time();

        // After stop, time should still work but use different baseline
        expect(time2).toBeGreaterThanOrEqual(0);
    });

    test("time function should track elapsed time", async () => {
        start();
        const time1 = time();

        // Wait a bit
        await new Promise((resolve) => setTimeout(resolve, 50));

        const time2 = time();

        expect(time2).toBeGreaterThan(time1);
        expect(time2 - time1).toBeGreaterThanOrEqual(50);

        stop();
    });

    test("time function should handle null event parameter", () => {
        start();
        const result = time(null);

        expect(result).toBeGreaterThanOrEqual(0);
        expect(typeof result).toBe("number");

        stop();
    });
});
