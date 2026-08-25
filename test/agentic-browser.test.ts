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

const AgenticBrowserSignalDimension = 39;
const Signals = {
    ClaudeAgentGlowBorder: "1",
    ClaudeAgentGlowBorderInner: "2",
    ClaudeAgentStopContainer: "3",
    ClaudeAgentStopButton: "4",
    ClaudePhantomCursor: "5",
    CodexAgentOverlayRoot: "6",
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
        for (const event of payload.dimension || []) {
            if (event.data && event.data[AgenticBrowserSignalDimension]) {
                signals.push(...event.data[AgenticBrowserSignalDimension]);
            }
        }
    }
    return signals;
}

test.describe("Agentic browser markers", (): void => {
    test("captures the Claude marker family", async ({ page }): Promise<void> => {
        await start(page, `
            <div id="claude-agent-glow-border">
                <div id="claude-agent-glow-border-inner"></div>
            </div>
            <div id="claude-agent-stop-container">
                <button id="claude-agent-stop-button"></button>
            </div>
            <div id="claude-phantom-cursor"></div>
        `);

        expect((await collect(page)).sort()).toEqual([
            Signals.ClaudeAgentGlowBorder,
            Signals.ClaudeAgentGlowBorderInner,
            Signals.ClaudeAgentStopContainer,
            Signals.ClaudeAgentStopButton,
            Signals.ClaudePhantomCursor,
        ].sort());
    });

    test("captures the Codex overlay root", async ({ page }): Promise<void> => {
        await start(page, `<script>
            const marker = document.createElement("div");
            marker.id = "codex-agent-overlay-root";
            document.documentElement.appendChild(marker);
        </script>`);

        expect(await collect(page)).toEqual([Signals.CodexAgentOverlayRoot]);
    });

    test("captures a root and its children inserted after load", async ({ page }): Promise<void> => {
        await start(page);
        await page.evaluate((): void => {
            const marker = document.createElement("div");
            marker.id = "claude-agent-glow-border";
            const inner = document.createElement("div");
            inner.id = "claude-agent-glow-border-inner";
            marker.appendChild(inner);
            document.body.appendChild(marker);
        });

        expect((await collect(page)).sort()).toEqual([
            Signals.ClaudeAgentGlowBorder,
            Signals.ClaudeAgentGlowBorderInner,
        ].sort());
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
            const marker = document.createElement("div");
            marker.id = "claude-agent-stop-container";
            const button = document.createElement("button");
            button.id = "claude-agent-stop-button";
            marker.appendChild(button);
            document.body.appendChild(marker);
            marker.remove();
        });

        expect((await collect(page)).sort()).toEqual([
            Signals.ClaudeAgentStopContainer,
            Signals.ClaudeAgentStopButton,
        ].sort());
    });

    test("retains a transient marker id assigned before removal", async ({ page }): Promise<void> => {
        await start(page);
        await page.evaluate((): void => {
            const marker = document.createElement("div");
            document.body.appendChild(marker);
            marker.id = "claude-phantom-cursor";
            marker.remove();
        });

        expect(await collect(page)).toEqual([Signals.ClaudePhantomCursor]);
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

    test("ignores markers outside the top-level injection points", async ({ page }): Promise<void> => {
        await start(page);
        await page.evaluate((): void => {
            const nested = document.createElement("div");
            const nestedMarker = document.createElement("div");
            nestedMarker.id = "claude-agent-glow-border";
            nested.appendChild(nestedMarker);
            document.body.appendChild(nested);

            const host = document.createElement("div");
            document.body.appendChild(host);
            const marker = document.createElement("div");
            marker.id = "claude-phantom-cursor";
            host.attachShadow({ mode: "open" }).appendChild(marker);
            const frame = document.createElement("iframe");
            frame.srcdoc = "<div id='claude-agent-stop-container'></div>";
            document.body.appendChild(frame);
        });

        expect(await collect(page)).toEqual([]);
    });

    test("ignores orphaned child and similar markers", async ({ page }): Promise<void> => {
        await start(page, `
            <div id="claude-agent-glow-border-inner"></div>
            <button id="claude-agent-stop-button"></button>
            <div id="claude-agent-stop-container-copy"></div>
            <div id="codex-agent-overlay-root-copy"></div>
        `);

        expect(await collect(page)).toEqual([]);
    });
});
