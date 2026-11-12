import { expect, test } from "@playwright/test";
import hash from "@src/core/hash";

test.describe("Core Utilities - Hash", () => {
    test("hash function should generate consistent hash for same input", () => {
        const input = "test-string";
        const hash1 = hash(input);
        const hash2 = hash(input);

        expect(hash1).toBe(hash2);
        expect(hash1).toBeTruthy();
        expect(typeof hash1).toBe("string");
    });

    test("hash function should generate different hashes for different inputs", () => {
        const hash1 = hash("input1");
        const hash2 = hash("input2");
        const hash3 = hash("completely-different-input");

        expect(hash1).not.toBe(hash2);
        expect(hash2).not.toBe(hash3);
        expect(hash1).not.toBe(hash3);
    });

    test("hash function should respect precision parameter", () => {
        const input = "test-precision";
        const hashNoPrecision = hash(input);
        const hash16 = hash(input, 16);
        const hash8 = hash(input, 8);

        expect(hashNoPrecision).toBeTruthy();
        expect(hash16).toBeTruthy();
        expect(hash8).toBeTruthy();

        // Hash with precision should be different from no precision
        expect(hashNoPrecision).not.toBe(hash16);

        // Verify precision limits: 2^16 = 65536, 2^8 = 256
        const hash16Num = parseInt(hash16, 36);
        const hash8Num = parseInt(hash8, 36);
        expect(hash16Num).toBeLessThan(65536);
        expect(hash8Num).toBeLessThan(256);
    });

    test("hash function should handle empty strings", () => {
        const result = hash("");
        expect(result).toBeTruthy();
        expect(typeof result).toBe("string");
    });

    test("hash function should handle special characters", () => {
        const hash1 = hash("test@example.com");
        const hash2 = hash("test#$%^&*()");
        const hash3 = hash("🎉🎊✨");

        expect(hash1).toBeTruthy();
        expect(hash2).toBeTruthy();
        expect(hash3).toBeTruthy();
        expect(hash1).not.toBe(hash2);
        expect(hash2).not.toBe(hash3);
    });

    test("hash function should produce base36 output", () => {
        const result = hash("test-base36");
        // Base36 should only contain 0-9 and a-z
        expect(/^[0-9a-z]+$/.test(result)).toBe(true);
    });
});
