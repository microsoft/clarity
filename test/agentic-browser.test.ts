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
    ClaudePhantomCursor: "5",
    CodexAgentOverlayRoot: "6",
    CodexBrowserSidebarCommentsRoot: "7",
} as const;

async function start(page: Page, markup: string = "", config: string = "", afterStart: string = ""): Promise<void> {
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
            ${config}
          });
          ${afterStart}
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

test.describe("Agentic browser presence", (): void => {
    test("captures Claude presence from an existing root", async ({ page }): Promise<void> => {
        await start(page, `
            <div id="claude-agent-glow-border"></div>
            <div id="claude-agent-glow-border-inner"></div>
            <div id="claude-agent-stop-container"></div>
            <button id="claude-agent-stop-button"></button>
            <div id="claude-phantom-cursor"></div>
        `);

        expect(await collect(page)).toEqual([Signals.ClaudeAgentGlowBorder]);
    });

    test("captures an existing Codex overlay root", async ({ page }): Promise<void> => {
        await start(page, `<script>
            const marker = document.createElement("div");
            marker.id = "codex-agent-overlay-root";
            document.documentElement.appendChild(marker);
        </script>`);

        expect(await collect(page)).toEqual([Signals.CodexAgentOverlayRoot]);
    });

    test("captures a Codex overlay root inserted after load", async ({ page }): Promise<void> => {
        await start(page);
        await page.evaluate((): void => {
            const marker = document.createElement("div");
            marker.id = "codex-agent-overlay-root";
            document.documentElement.appendChild(marker);
        });

        expect(await collect(page)).toEqual([Signals.CodexAgentOverlayRoot]);
    });

    test("captures an existing Codex sidebar root", async ({ page }): Promise<void> => {
        await start(page, `<script>
            const marker = document.createElement("div");
            marker.id = "codex-browser-sidebar-comments-root";
            document.documentElement.appendChild(marker);
        </script>`);

        expect(await collect(page)).toEqual([Signals.CodexBrowserSidebarCommentsRoot]);
    });

    test("captures a Codex sidebar root inserted after load", async ({ page }): Promise<void> => {
        await start(page);
        await page.evaluate((): void => {
            const marker = document.createElement("div");
            marker.id = "codex-browser-sidebar-comments-root";
            document.documentElement.appendChild(marker);
        });

        expect(await collect(page)).toEqual([Signals.CodexBrowserSidebarCommentsRoot]);
    });

    test("captures both products when both are present", async ({ page }): Promise<void> => {
        await start(page, `<div id="claude-agent-glow-border"></div><script>
            const marker = document.createElement("div");
            marker.id = "codex-browser-sidebar-comments-root";
            document.documentElement.appendChild(marker);
        </script>`);

        expect((await collect(page)).sort()).toEqual([
            Signals.ClaudeAgentGlowBorder,
            Signals.CodexBrowserSidebarCommentsRoot,
        ]);
    });

    test("rescans for roots when DOM observation is delayed", async ({ page }): Promise<void> => {
        await start(page, "", ", delayDom: true", `
            const marker = document.createElement("div");
            marker.id = "codex-browser-sidebar-comments-root";
            document.documentElement.appendChild(marker);
        `);

        expect(await collect(page)).toEqual([Signals.CodexBrowserSidebarCommentsRoot]);
    });

    test("retains a transient Codex overlay root", async ({ page }): Promise<void> => {
        await start(page);
        await page.evaluate((): void => {
            const marker = document.createElement("div");
            marker.id = "codex-agent-overlay-root";
            document.documentElement.appendChild(marker);
            marker.remove();
        });

        expect(await collect(page)).toEqual([Signals.CodexAgentOverlayRoot]);
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

    test("ignores an id assigned after insertion", async ({ page }): Promise<void> => {
        await start(page);
        await page.evaluate((): void => {
            const marker = document.createElement("div");
            marker.id = "pending-marker";
            document.body.appendChild(marker);
        });
        await page.waitForTimeout(150);
        await page.evaluate((): void => {
            document.getElementById("pending-marker").id = "claude-agent-glow-border";
        });

        expect(await collect(page)).toEqual([]);
    });

    test("captures an id assigned synchronously after insertion", async ({ page }): Promise<void> => {
        await start(page);
        await page.evaluate((): void => {
            const marker = document.createElement("div");
            document.body.appendChild(marker);
            marker.id = "claude-agent-glow-border";
        });

        expect(await collect(page)).toEqual([Signals.ClaudeAgentGlowBorder]);
    });

    test("retains a transient marker removed before upload", async ({ page }): Promise<void> => {
        await start(page);
        await page.evaluate((): void => {
            const marker = document.createElement("div");
            marker.id = "claude-agent-glow-border";
            document.body.appendChild(marker);
            marker.remove();
        });

        expect(await collect(page)).toEqual([Signals.ClaudeAgentGlowBorder]);
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

    test("ignores a marker in an open shadow root", async ({ page }): Promise<void> => {
        await start(page);
        await page.evaluate((): void => {
            const host = document.createElement("div");
            document.body.appendChild(host);
            const marker = document.createElement("div");
            marker.id = "claude-phantom-cursor";
            host.attachShadow({ mode: "open" }).appendChild(marker);
        });

        expect(await collect(page)).toEqual([]);
    });

    test("ignores a marker in a same-origin iframe", async ({ page }): Promise<void> => {
        await start(page);
        await page.evaluate((): void => {
            const frame = document.createElement("iframe");
            frame.srcdoc = "<div id='claude-agent-glow-border'></div>";
            document.body.appendChild(frame);
        });

        expect(await collect(page)).toEqual([]);
    });

    test("does not emit a dimension for nested or similar markers", async ({ page }): Promise<void> => {
        await start(page, `
            <div><div id="claude-agent-glow-border"></div></div>
            <div id="claude-agent-glow-border-copy"></div>
            <div id="codex-agent-overlay-root-copy"></div>
            <div id="codex-browser-sidebar-comments-root"></div>
            <script>
                const marker = document.createElement("div");
                marker.id = "claude-agent-glow-border";
                document.documentElement.appendChild(marker);
            </script>
        `);

        expect(await collect(page)).toEqual([]);
    });
});
