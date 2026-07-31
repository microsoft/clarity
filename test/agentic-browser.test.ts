import { expect, test } from "@playwright/test";
import { decode } from "clarity-decode";
import { readFileSync } from "fs";
import { resolve } from "path";
import { pathToFileURL } from "url";
import type { Page } from "@playwright/test";
import type { Data } from "clarity-decode";

declare global {
    interface Window {
        clarity: (method: string, ...args: any[]) => void;
        payloads: string[];
    }
}

const Variable = "<!>ABS";
const Signals = {
    ClaudeAgentGlowBorder: "1",
    ClaudeAgentGlowBorderInner: "2",
    ClaudeAgentStopContainer: "3",
    ClaudeAgentStopButton: "4",
    ClaudePhantomCursor: "5",
} as const;

async function start(page: Page, markup: string = ""): Promise<void> {
    const htmlPath = resolve(__dirname, "./html/core.html");
    const htmlFileUrl = pathToFileURL(htmlPath).toString();
    const html = readFileSync(htmlPath, "utf8");
    const clarity = readFileSync(resolve(__dirname, "../packages/clarity-js/build/clarity.min.js"), "utf8");
    await page.goto(htmlFileUrl);
    await page.setContent(html.replace("</body>", `${markup}
        <script>
          window.payloads = [];
          ${clarity};
          clarity("start", {
            delay: 50,
            projectId: "test",
            upload: (payload) => { window.payloads.push(payload); }
          });
        </script>
        </body>
    `));
}

async function collect(page: Page): Promise<string[]> {
    await page.waitForTimeout(300);
    await page.evaluate((): void => window.clarity("stop"));
    await page.waitForFunction("window.payloads.length > 0");
    const payloads = await page.evaluate((): string[] => window.payloads);
    const signals: string[] = [];
    for (const payload of payloads.map((value: string): Data.DecodedPayload => decode(value))) {
        for (const event of payload.variable || []) {
            if (event.data && event.data[Variable]) {
                signals.push(...event.data[Variable]);
            }
        }
    }
    return signals;
}

test.describe("Agentic browser markers", (): void => {
    test("captures the Claude marker family", async ({ page }): Promise<void> => {
        await start(page, `
            <div id="claude-agent-glow-border"></div>
            <div id="claude-agent-glow-border-inner"></div>
            <div id="claude-agent-stop-container"></div>
            <button id="claude-agent-stop-button"></button>
            <div id="claude-phantom-cursor"></div>
        `);

        expect((await collect(page)).sort()).toEqual(Object.values(Signals).sort());
    });

    test("captures a marker inserted after load", async ({ page }): Promise<void> => {
        await start(page);
        await page.evaluate((): void => {
            const marker = document.createElement("div");
            marker.id = "claude-agent-glow-border";
            document.body.appendChild(marker);
        });

        expect(await collect(page)).toEqual([Signals.ClaudeAgentGlowBorder]);
    });

    test("captures an id assigned after insertion", async ({ page }): Promise<void> => {
        await start(page);
        await page.evaluate((): void => {
            const marker = document.createElement("div");
            marker.id = "pending-marker";
            document.body.appendChild(marker);
        });
        await page.waitForTimeout(150);
        await page.evaluate((): void => {
            document.getElementById("pending-marker").id = "claude-agent-stop-container";
        });

        expect(await collect(page)).toEqual([Signals.ClaudeAgentStopContainer]);
    });

    test("retains a transient marker removed before upload", async ({ page }): Promise<void> => {
        await start(page);
        await page.evaluate((): void => {
            const marker = document.createElement("button");
            marker.id = "claude-agent-stop-button";
            document.body.appendChild(marker);
            marker.remove();
        });

        expect(await collect(page)).toEqual([Signals.ClaudeAgentStopButton]);
    });

    test("emits each marker once per page", async ({ page }): Promise<void> => {
        await start(page);
        await page.evaluate((): void => {
            for (let i = 0; i < 2; i++) {
                const marker = document.createElement("div");
                marker.id = "claude-phantom-cursor";
                document.body.appendChild(marker);
            }
        });

        expect(await collect(page)).toEqual([Signals.ClaudePhantomCursor]);
    });

    test("captures a marker in an open shadow root", async ({ page }): Promise<void> => {
        await start(page);
        await page.evaluate((): void => {
            const host = document.createElement("div");
            document.body.appendChild(host);
            const marker = document.createElement("div");
            marker.id = "claude-phantom-cursor";
            host.attachShadow({ mode: "open" }).appendChild(marker);
        });

        expect(await collect(page)).toEqual([Signals.ClaudePhantomCursor]);
    });

    test("captures a marker in a same-origin iframe", async ({ page }): Promise<void> => {
        await start(page);
        await page.evaluate((): void => {
            const frame = document.createElement("iframe");
            frame.srcdoc = "<div id='claude-agent-stop-button'></div>";
            document.body.appendChild(frame);
        });

        expect(await collect(page)).toEqual([Signals.ClaudeAgentStopButton]);
    });

    test("does not emit a variable for similar ids", async ({ page }): Promise<void> => {
        await start(page, `<div id="claude-agent-stop-container-copy"></div>`);

        expect(await collect(page)).toEqual([]);
    });
});
