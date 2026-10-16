import { expect, test } from "@playwright/test";
import { resolve } from "path";

test("replays hover styling in readable imported and nested CSSOM rules", async ({ page }) => {
    await page.route("https://replay.test/**", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === "/styles.css") {
            await route.fulfill({
                contentType: "text/css",
                body: [
                    '@import url("./imported.css");',
                    ".target { color: rgb(0, 0, 255); }",
                    "@media all { @supports (display: block) { .target:hover { color: rgb(255, 0, 0); } } }",
                    '.target:hover::before { content: ":hover"; }',
                    ".hover\\:enabled:hover { border-top: 3px solid; }",
                    ".card:hover { color: rgb(255, 0, 0); & .child:hover { color: rgb(0, 128, 0); } }"
                ].join("\n")
            });
        } else if (url.pathname === "/imported.css") {
            await route.fulfill({
                contentType: "text/css",
                body: ".imported:hover { background-color: rgb(255, 255, 0); }"
            });
        } else {
            await route.fulfill({
                contentType: "text/html",
                body: "<!doctype html><html><head></head><body></body></html>"
            });
        }
    });
    await page.goto("https://replay.test/");
    await page.addScriptTag({ path: resolve(__dirname, "..", "build", "clarity.visualize.min.js") });

    const result = await page.evaluate(async () => {
        const api = (window as Window & { clarity: { visualize: typeof import("../src/clarity") } }).clarity.visualize;
        const errors: string[] = [];
        const visualizer = await api.setup(window, {
            version: "0.8.72",
            logerror: (error: Error): void => { errors.push(error.message); }
        });
        const target = document.createElement("div");
        target.className = "target imported hover:enabled";
        target.setAttribute("clarity-hover", "");
        const card = document.createElement("div");
        card.className = "card";
        card.setAttribute("clarity-hover", "");
        const child = document.createElement("div");
        child.className = "child";
        child.setAttribute("clarity-hover", "");
        card.appendChild(child);
        document.body.append(target, card);

        const layout = visualizer.layout;
        layout.nodes[1] = document.head;
        await layout.dom({ event: 6, time: 0, data: [{
            id: 2, parent: 1, previous: null, tag: "LINK",
            attributes: { rel: "stylesheet", href: "https://replay.test/styles.css" }
        }] });
        const hovered = {
            color: getComputedStyle(target).color,
            background: getComputedStyle(target).backgroundColor,
            border: getComputedStyle(target).borderTopWidth,
            content: getComputedStyle(target, "::before").content,
            card: getComputedStyle(card).color,
            child: getComputedStyle(child).color
        };
        target.removeAttribute("clarity-hover");
        return { hovered, normalColor: getComputedStyle(target).color, errors };
    });

    expect(result).toEqual({
        hovered: {
            color: "rgb(255, 0, 0)",
            background: "rgb(255, 255, 0)",
            border: "3px",
            content: '":hover"',
            card: "rgb(255, 0, 0)",
            child: "rgb(0, 128, 0)"
        },
        normalColor: "rgb(0, 0, 255)",
        errors: []
    });
});
