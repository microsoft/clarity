import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

const clarityJsPath = join(__dirname, "../build/clarity.min.js");
const DimensionEvent = 1;
const PageHeadingsDimension = 202;

async function collect(page: any, enabled: boolean): Promise<string[]> {
    const clarityJs = readFileSync(clarityJsPath, "utf-8");
    await page.addScriptTag({ content: clarityJs });
    const payloads: string[] = await page.evaluate(async (pageHeadings) => {
        const output: string[] = [];
        (window as any).clarity("start", {
            projectId: "test",
            track: false,
            delay: 50,
            pageHeadings,
            upload: (payload: string): void => { output.push(payload); }
        });
        await new Promise((resolve): number => window.setTimeout(resolve, 400));
        (window as any).clarity("stop");
        return output;
    }, enabled);

    const values: string[] = [];
    for (const payload of payloads) {
        const events = JSON.parse(payload).a || [];
        for (const tokens of events) {
            if (tokens[1] !== DimensionEvent) {
                continue;
            }
            for (let i = 4; i < tokens.length - 1; i += 2) {
                if (tokens[i] === PageHeadingsDimension) {
                    values.push(...tokens[i + 1]);
                }
            }
        }
    }
    return values;
}

test.describe("page headings", () => {
    test("captures the first three non-empty headings in document order", async ({ page }) => {
        await page.setContent(`
            <div><h1>  First   heading  </h1></div>
            <h2>Second heading</h2>
            <section><h3>Third heading with more than thirty characters</h3></section>
            <h4>Fourth heading</h4>
        `);

        const values = await collect(page, true);

        expect(values).toEqual([
            JSON.stringify(["First heading", "Second heading", "Third heading with more than t"])
        ]);
    });

    test("skips empty and shadow-root headings", async ({ page }) => {
        await page.setContent("<h1> </h1><div id='host'></div><h2>Visible</h2>");
        await page.evaluate(() => {
            const root = document.getElementById("host").attachShadow({ mode: "open" });
            root.innerHTML = "<h1>Shadow heading</h1>";
        });

        const values = await collect(page, true);

        expect(values).toEqual([JSON.stringify(["Visible"])]);
    });

    test("emits nothing when disabled or when no headings exist", async ({ page }) => {
        await page.setContent("<h1>Disabled</h1>");
        expect(await collect(page, false)).toEqual([]);

        await page.setContent("<p>No headings</p>");
        expect(await collect(page, true)).toEqual([]);
    });
});
