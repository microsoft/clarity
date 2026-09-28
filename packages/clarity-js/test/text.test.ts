import { expect, test } from "@playwright/test";
import { normalizeText } from "@src/core/text";
import { readFileSync } from "fs";
import { join } from "path";
import { Config } from "../types/core";

const clarityJsPath = join(__dirname, "../build/clarity.min.js");
const ClickEvent = 9;

type ClickWindow = typeof window & {
    clarity: (command: "start" | "stop", config?: Config) => void;
    clickPayloads: string[];
};

interface ClickValue {
    text: unknown;
    isFullText: unknown;
}

function clicks(payloads: string[]): ClickValue[] {
    const output: ClickValue[] = [];
    for (const payload of payloads) {
        const events = (JSON.parse(payload) as { a?: unknown[][] }).a || [];
        for (const tokens of events) {
            if (tokens[1] === ClickEvent) {
                output.push({ text: tokens[10], isFullText: tokens[14] });
            }
        }
    }
    return output;
}

test.describe("text normalization", () => {
    const cases = [
        { name: "preserves ordinary text", input: "Checkout", expected: "Checkout" },
        { name: "handles empty text", input: "", expected: "" },
        { name: "removes whitespace-only text", input: " \t\r\n\u00a0 ", expected: "" },
        { name: "collapses and trims whitespace", input: " \tAlpha\u00a0  Beta\r\nGamma ", expected: "Alpha Beta Gamma" },
        { name: "does not truncate", input: "long".repeat(20), expected: "long".repeat(20) },
        { name: "does not apply privacy rules", input: "Order 123 alice@example.com", expected: "Order 123 alice@example.com" }
    ];

    for (const entry of cases) {
        test(entry.name, () => {
            expect(normalizeText(entry.input)).toBe(entry.expected);
            expect(normalizeText(entry.input)).toBe(entry.expected);
        });
    }

    test("preserves click fallbacks, empty values, truncation, completeness and privacy", async ({ page }) => {
        const fixtures = [
            { id: "plain", html: "<button id='plain'>  Buy\t now </button>", text: "Buy now", isFullText: 1 },
            { id: "empty", html: "<button id='empty'></button>", text: null, isFullText: 0 },
            { id: "space", html: "<button id='space' value='Fallback'> \t </button>", text: "", isFullText: 1 },
            { id: "input", html: "<input id='input' type='button' value=' Input   label '>", text: "Input label", isFullText: 1 },
            { id: "image", html: "<img id='image' alt=' Image   label '>", text: "Image label", isFullText: 1 },
            { id: "exact", html: `<button id='exact'>${"A".repeat(25)}</button>`, text: "A".repeat(25), isFullText: 1 },
            { id: "long", html: `<button id='long'>${"A".repeat(26)}</button>`, text: "A".repeat(25), isFullText: 0 },
            { id: "digits", html: "<button id='digits'>Order 123</button>", text: "Order \u25ab\u25ab\u25ab", isFullText: 1 },
            {
                id: "masked", html: "<button id='masked' data-clarity-mask>Checkout</button>",
                text: "\u2022\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022", isFullText: 1
            },
            {
                id: "unmasked", html: "<button id='unmasked' data-clarity-unmask>Order 123</button>",
                text: "Order 123", isFullText: 1
            }
        ];
        await page.route("**/*", (route) => route.abort());
        await page.setContent(fixtures.map((entry) => entry.html).join(""));
        await page.addScriptTag({ content: readFileSync(clarityJsPath, "utf-8") });
        await page.evaluate((): void => {
            const capture = window as ClickWindow;
            capture.clickPayloads = [];
            capture.clarity("start", {
                projectId: "test", track: false, delay: 50,
                upload: (payload: string): void => { capture.clickPayloads.push(payload); }
            });
        });
        await page.waitForFunction((): boolean => (window as ClickWindow).clickPayloads.length > 0);
        for (const entry of fixtures) {
            await page.locator("#" + entry.id).dispatchEvent("click", {
                bubbles: true, clientX: 10, clientY: 10, detail: 1, button: 0
            });
        }
        await expect.poll(async (): Promise<number> => {
            const pendingPayloads = await page.evaluate((): string[] => (window as ClickWindow).clickPayloads);
            return clicks(pendingPayloads).length;
        }).toBe(fixtures.length);
        const payloads = await page.evaluate((): string[] => {
            const capture = window as ClickWindow;
            capture.clarity("stop");
            return capture.clickPayloads;
        });
        expect(clicks(payloads)).toEqual(fixtures.map((entry): ClickValue => ({ text: entry.text, isFullText: entry.isFullText })));
    });
});
