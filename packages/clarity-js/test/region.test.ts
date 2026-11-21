import { expect, Page, test } from "@playwright/test";
import { join } from "path";

declare global {
    interface Window {
        regionEvents: (number | string)[][];
        regionStart: number;
    }
}

test.use({ viewport: { width: 800, height: 600 } });

async function start(page: Page, build: string = "extended"): Promise<void> {
    await page.route("https://region.test/", route => route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><style>body{margin:0} #region{position:absolute;left:100px;top:100px;width:300px;height:200px;background:blue}</style><div id="region" data-clarity-region="content"></div>'
    }));
    await page.goto("https://region.test/");
    await page.addScriptTag({ path: join(__dirname, `../build/clarity.${build === "extended" ? "extended" : "min"}.js`) });
    await page.evaluate(() => {
        window.regionEvents = [];
        window.regionStart = performance.now();
        const clarity: unknown = Reflect.get(window, "clarity");
        if (typeof clarity !== "function") { throw new Error("Missing Clarity"); }
        clarity("start", {
            projectId: "regions", track: false, delay: 100,
            upload: (payload: string): void => {
                const parsed = JSON.parse(payload);
                window.regionEvents.push(...parsed.a);
            }
        });
    });
    await page.waitForTimeout(250);
}

async function pane(page: Page, options: { width?: number; left?: number; background?: string;
    native?: boolean; shadow?: boolean; z?: number; wrapper?: boolean } = {}): Promise<number> {
    return page.evaluate(settings => {
        let root: HTMLElement | ShadowRoot = document.body;
        if (settings.shadow) {
            const host = document.createElement("section");
            document.body.append(host);
            root = host.attachShadow({ mode: "open" });
        }
        const dialog = document.createElement(settings.native ? "dialog" : "div");
        dialog.id = "modal";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.style.cssText = `position:fixed;box-sizing:border-box;padding:0;border:0;margin:0;left:${settings.left ?? 100}px;top:100px;width:${settings.width ?? 300}px;height:200px;background:${settings.background ?? "rgba(255,255,255,.867)"};z-index:${settings.z ?? 999};`;
        if (settings.wrapper) {
            const content = document.createElement("div");
            content.style.cssText = "width:100%;height:100%;background:white";
            dialog.append(content);
        }
        root.append(dialog);
        if (dialog instanceof HTMLDialogElement) { dialog.showModal(); }
        return performance.now() - window.regionStart;
    }, options);
}

async function finish(page: Page): Promise<(number | string)[][]> {
    await page.evaluate(() => {
        const clarity: unknown = Reflect.get(window, "clarity");
        if (typeof clarity !== "function") { throw new Error("Missing Clarity"); }
        clarity("stop");
    });
    return page.evaluate(() => window.regionEvents.filter(e => e[1] === 7 && e[5] === "content" && Number(e[4]) >= 14));
}

test("extended observes shown, hidden and removed panes once at actual observation times", async ({ page }) => {
    await start(page);
    const shown = await pane(page);
    await page.waitForTimeout(200);
    await page.locator("#modal").evaluate(e => (e as HTMLElement).style.display = "none");
    await page.waitForTimeout(200);
    await page.locator("#modal").evaluate(e => (e as HTMLElement).style.display = "block");
    await page.waitForTimeout(200);
    await page.locator("#modal").evaluate(e => e.remove());
    await page.waitForTimeout(200);
    const events = await finish(page);
    expect(events.map(e => e[4])).toEqual([14, 15, 14, 15, 14]);
    expect(Number(events[1][0])).toBeGreaterThanOrEqual(Math.floor(shown));
    expect(Number(events[1][0]) - shown).toBeLessThan(180);
    expect(events.every((e, i) => !i || Number(e[0]) >= Number(events[i - 1][0]))).toBe(true);
    expect(new Set(events.map(e => e[2])).size).toBe(1);
});

for (const settings of [{ native: true }, { shadow: true }, { background: "transparent", wrapper: true }]) {
    test(`covers ${JSON.stringify(settings)} without IO geometry change`, async ({ page }) => {
        await start(page);
        await pane(page, settings);
        await page.waitForTimeout(250);
        expect((await finish(page)).map(e => e[4])).toEqual([14, 15]);
    });
}

for (const settings of [{ width: 299 }, { background: "transparent" }, { z: -1 }]) {
    test(`preserves exposure ${JSON.stringify(settings)}`, async ({ page }) => {
        await start(page);
        await pane(page, settings);
        await page.waitForTimeout(250);
        expect((await finish(page)).map(e => e[4])).toEqual([14]);
    });
}

test("overlapping pane union covers fully, then removal exposes the remaining gap", async ({ page }) => {
    await start(page);
    await pane(page, { width: 160 });
    await page.waitForTimeout(180);
    await pane(page, { left: 250, width: 150 });
    await page.waitForTimeout(180);
    await page.locator("#modal").last().evaluate(e => e.remove());
    await page.waitForTimeout(180);
    expect((await finish(page)).map(e => e[4])).toEqual([14, 15, 14]);
});

test("dialog region content does not occlude itself", async ({ page }) => {
    await start(page);
    await pane(page);
    await page.evaluate(() => document.querySelector("#modal").append(document.querySelector("#region")));
    await page.waitForTimeout(250);
    expect((await finish(page)).map(e => e[4])).toEqual([14]);
});

test("hidden time does not reopen exposure behind an unchanged dialog", async ({ page }) => {
    await start(page);
    await pane(page);
    await page.waitForTimeout(180);
    for (const state of ["hidden", "visible"]) {
        await page.evaluate(value => {
            Object.defineProperty(document, "visibilityState", { configurable: true, value });
            document.dispatchEvent(new Event("visibilitychange"));
        }, state);
        await page.waitForTimeout(180);
    }
    await page.locator("#modal").evaluate(e => e.remove());
    await page.waitForTimeout(180);
    expect((await finish(page)).map(e => e[4])).toEqual([14, 15, 14]);
});

test("hidden/resume without dialogs preserves geometric membership", async ({ page }) => {
    await start(page);
    for (const state of ["hidden", "visible", "visible"]) {
        await page.evaluate(value => {
            Object.defineProperty(document, "visibilityState", { configurable: true, value });
            document.dispatchEvent(new Event("visibilitychange"));
        }, state);
    }
    expect((await finish(page)).map(e => e[4])).toEqual([14]);
    const visibility = await page.evaluate(() => window.regionEvents.filter(e => e[1] === 28));
    expect(visibility.map(e => e[2])).toEqual([1, 0, 1, 1]);
    console.log("Stable region hidden/resume wire events:", await page.evaluate(() =>
        window.regionEvents.filter(e => e[1] === 28 || e[1] === 7 && Number(e[4]) >= 14)));
});

for (const shownWhileHidden of [true, false]) {
    test(`dialog ${shownWhileHidden ? "shown" : "removed"} while hidden changes membership only when observed`, async ({ page }) => {
        await start(page);
        if (!shownWhileHidden) { await pane(page); await page.waitForTimeout(180); }
        await page.evaluate(() => {
            Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
            document.dispatchEvent(new Event("visibilitychange"));
        });
        if (shownWhileHidden) { await pane(page); }
        else { await page.locator("#modal").evaluate(e => e.remove()); }
        await page.waitForTimeout(180);
        const resumed = await page.evaluate(() => {
            const now = performance.now() - window.regionStart;
            Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
            document.dispatchEvent(new Event("visibilitychange"));
            return now;
        });
        await page.waitForTimeout(180);
        const events = await finish(page);
        expect(events.map(e => e[4])).toEqual(shownWhileHidden ? [14, 15] : [14, 15, 14]);
        expect(Number(events[events.length - 1][0])).toBeGreaterThanOrEqual(Math.floor(resumed));
        const wire = await page.evaluate(() =>
            window.regionEvents.filter(e => e[1] === 28 || e[1] === 7 && Number(e[4]) >= 14));
        expect(wire.filter(e => e[1] === 28).map(e => e[2])).toEqual([1, 0, 1]);
        console.log(`Dialog ${shownWhileHidden ? "shown" : "removed"} while hidden wire events:`, wire);
    });
}

test("dialog shown and removed entirely while hidden does not split a visit, even with IO callbacks", async ({ page }) => {
    await start(page);
    await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await pane(page);
    await page.locator("#modal").evaluate(e => {
        (e as HTMLElement).style.cssText = "position:fixed;inset:0;background:white;z-index:999";
        // Cross an IO ratio threshold without leaving the viewport geometrically.
        document.querySelector<HTMLElement>("#region").style.left = "-10px";
    });
    await page.waitForTimeout(180);
    await page.locator("#modal").evaluate(e => {
        e.remove();
        document.querySelector<HTMLElement>("#region").style.left = "100px";
    });
    await page.waitForTimeout(180);
    await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    expect((await finish(page)).map(e => e[4])).toEqual([14]);
    const wire = await page.evaluate(() =>
        window.regionEvents.filter(e => e[1] === 28 || e[1] === 7 && Number(e[4]) >= 14));
    expect(wire.filter(e => e[1] === 28).map(e => e[2])).toEqual([1, 0, 1]);
    console.log("Dialog entirely inside hidden interval wire events:", wire);
});

test("scroll and pane resizing use current viewport-clipped bounds", async ({ page }) => {
    await start(page);
    await pane(page, { width: 200 });
    await page.waitForTimeout(180);
    await page.locator("#modal").evaluate(e => (e as HTMLElement).style.width = "300px");
    await page.waitForTimeout(180);
    await page.evaluate(() => {
        document.body.style.height = "2000px";
        window.scrollTo(0, 150);
    });
    await page.waitForTimeout(180);
    expect((await finish(page)).map(e => e[4])).toEqual([14, 15, 14]);
});

test("samples actual animated translation and stops sampling after animation", async ({ page }) => {
    await start(page);
    await pane(page, { left: 500 });
    await page.locator("#modal").evaluate(e => {
        (e as HTMLElement).style.transition = "transform 400ms linear";
        (e as HTMLElement).style.transform = "translateX(-400px)";
    });
    await page.waitForTimeout(650);
    expect((await finish(page)).map(e => e[4])).toEqual([14, 15]);
});

test("legacy production variant does not gain viewport or dialog tracking", async ({ page }) => {
    await start(page, "normal");
    await pane(page);
    await page.waitForTimeout(200);
    expect(await finish(page)).toEqual([]);
});

test("stop disconnects geometry work; restart produces a fresh initial exposure", async ({ page }) => {
    await start(page);
    await pane(page);
    await page.waitForTimeout(180);
    expect((await finish(page)).map(e => e[4])).toEqual([14, 15]);
    const cost = await page.evaluate(async () => {
        let calls = 0;
        const original = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function(): DOMRect { calls++; return original.call(this); };
        document.querySelector("#modal").remove();
        window.dispatchEvent(new Event("resize"));
        await new Promise(resolve => setTimeout(resolve, 250));
        Element.prototype.getBoundingClientRect = original;
        return calls;
    });
    expect(cost).toBe(0);
    await page.evaluate(() => {
        window.regionEvents = [];
        const clarity: unknown = Reflect.get(window, "clarity");
        if (typeof clarity !== "function") { throw new Error("Missing Clarity"); }
        clarity("start", { projectId: "regions", track: false, delay: 100,
            upload: (p: string): void => { window.regionEvents.push(...JSON.parse(p).a); } });
    });
    await page.waitForTimeout(250);
    expect((await finish(page)).map(e => e[4])).toEqual([14]);
});

test("native close, zero-size region and restoration preserve exit/enter state", async ({ page }) => {
    await start(page);
    await pane(page, { native: true });
    await page.waitForTimeout(180);
    await page.locator("#modal").evaluate(e => (e as HTMLDialogElement).close());
    await page.waitForTimeout(180);
    await page.locator("#region").evaluate(e => (e as HTMLElement).style.display = "none");
    await page.waitForTimeout(180);
    await page.locator("#region").evaluate(e => (e as HTMLElement).style.display = "block");
    await page.waitForTimeout(180);
    expect((await finish(page)).map(e => e[4])).toEqual([14, 15, 14, 15, 14]);
});

test("nested shadow alertdialog can cover a rounded region", async ({ page }) => {
    await start(page);
    await pane(page, { shadow: true });
    await page.evaluate(() => {
        const outer = document.querySelector("section").shadowRoot;
        const host = document.createElement("section");
        const modal = outer.querySelector("#modal");
        outer.append(host);
        host.attachShadow({ mode: "open" }).append(modal);
        modal.setAttribute("role", "alertdialog");
        document.querySelector<HTMLElement>("#region").style.borderRadius = "10px";
    });
    await page.waitForTimeout(250);
    expect((await finish(page)).map(e => e[4])).toEqual([14, 15]);
});

for (const style of ["border-radius:10px", "clip-path:circle(20%)", "opacity:0", "transform:rotate(5deg)",
    "scale:2", "pointer-events:none"]) {
    test(`does not infer full coverage from unsupported or unpainted pane: ${style}`, async ({ page }) => {
        await start(page);
        await pane(page);
        await page.locator("#modal").evaluate((e, value) => (e as HTMLElement).style.cssText += value, style);
        await page.waitForTimeout(250);
        expect((await finish(page)).map(e => e[4])).toEqual([14]);
    });
}

test("ancestor overflow clipping leaves uncovered region exposed", async ({ page }) => {
    await start(page);
    await pane(page);
    await page.evaluate(() => {
        const clip = document.createElement("div");
        clip.style.cssText = "position:absolute;left:100px;top:100px;width:200px;height:200px;overflow:hidden";
        document.body.append(clip);
        const modal = document.querySelector<HTMLElement>("#modal");
        modal.style.position = "absolute";
        modal.style.left = "0";
        modal.style.top = "0";
        clip.append(modal);
    });
    await page.waitForTimeout(250);
    expect((await finish(page)).map(e => e[4])).toEqual([14]);
});

test("observes ancestor translation while it is running", async ({ page }) => {
    await start(page);
    await pane(page, { left: 500 });
    await page.evaluate(() => {
        const host = document.createElement("div");
        document.body.append(host);
        host.append(document.querySelector("#modal"));
        host.style.transition = "transform 400ms linear";
        host.getBoundingClientRect();
        host.style.transform = "translateX(-400px)";
    });
    await page.waitForTimeout(650);
    expect((await finish(page)).map(e => e[4])).toEqual([14, 15]);
});

test("batches mutation bursts, performs no idle hit tests, and stays bounded for 20 regions", async ({ page }) => {
    await start(page);
    await page.evaluate(() => {
        for (let i = 1; i < 20; i++) {
            const region = document.querySelector("#region").cloneNode(true) as HTMLElement;
            region.id = `region${i}`;
            region.setAttribute("data-clarity-region", `region${i}`);
            region.style.cssText = "position:absolute;left:100px;top:100px;width:300px;height:200px";
            document.body.append(region);
        }
    });
    await pane(page);
    await page.waitForTimeout(350);
    const counts = await page.evaluate(async () => {
        const original = document.elementsFromPoint;
        let count = 0;
        let milliseconds = 0;
        document.elementsFromPoint = function(x: number, y: number): Element[] {
            const begin = performance.now();
            const result = original.call(this, x, y);
            milliseconds += performance.now() - begin;
            count++;
            return result;
        };
        await new Promise(resolve => setTimeout(resolve, 350));
        const idle = count;
        for (let i = 0; i < 100; i++) { document.body.setAttribute("data-burst", String(i)); }
        await new Promise(resolve => setTimeout(resolve, 250));
        document.elementsFromPoint = original;
        return { idle, burst: count - idle, hitTestMilliseconds: milliseconds };
    });
    expect(counts.idle).toBe(0);
    expect(counts.burst).toBeGreaterThan(0);
    expect(counts.burst).toBeLessThanOrEqual(200);
    console.log("Region coverage work (20 regions / 100 mutations):", counts);
    await finish(page);
});

for (const shadow of [false, true]) {
    test(`painted fullscreen sibling backdrop covers beyond a transparent partial modal (shadow=${shadow})`, async ({ page }) => {
        await start(page);
        await pane(page, { left: 600, width: 100, background: "transparent", shadow });
        await page.locator("#modal").evaluate(e => {
            const backdrop = document.createElement("div");
            backdrop.id = "backdrop";
            backdrop.style.cssText = "position:fixed;inset:0;background:black;opacity:.7;z-index:998";
            e.parentNode.appendChild(backdrop);
        });
        await page.waitForTimeout(250);
        await page.locator("#backdrop").evaluate(e => e.remove());
        await page.waitForTimeout(180);
        expect((await finish(page)).map(e => e[4])).toEqual([14, 15, 14]);
    });
}

for (const style of ["z-index:1000", "z-index:-1", "opacity:0", "right:1px"]) {
    test(`does not associate an invalid sibling backdrop: ${style}`, async ({ page }) => {
        await start(page);
        await pane(page, { left: 600, width: 100 });
        await page.locator("#modal").evaluate((e, override) => {
            const backdrop = document.createElement("div");
            backdrop.style.cssText = "position:fixed;inset:0;background:black;opacity:.7;z-index:998;" + override;
            e.parentNode.appendChild(backdrop);
        }, style);
        await page.waitForTimeout(250);
        expect((await finish(page)).map(e => e[4])).toEqual([14]);
    });
}

for (const painted of [true, false]) {
    test(`native partial modal counts only its painted fullscreen backdrop (painted=${painted})`, async ({ page }) => {
        await start(page);
        await page.addStyleTag({ content: `dialog::backdrop { background: ${painted ? "rgba(0,0,0,.7)" : "transparent"}; }` });
        await pane(page, { native: true, left: 600, width: 100 });
        await page.waitForTimeout(250);
        expect((await finish(page)).map(e => e[4])).toEqual(painted ? [14, 15] : [14]);
    });
}

test("inset-zero associated backdrop uses actual geometry without stretching a viewport gutter", async ({ page }) => {
    await start(page);
    await pane(page, { left: 600, width: 100, shadow: true });
    await page.locator("#modal").evaluate(e => {
        const backdrop = document.createElement("div");
        backdrop.style.cssText = "position:fixed;inset:0;width:785px;background:black;opacity:.7;z-index:998";
        e.parentNode.appendChild(backdrop);
    });
    await page.waitForTimeout(200);
    await page.locator("#region").evaluate(e => (e as HTMLElement).style.left = "490px");
    await page.waitForTimeout(200);
    expect((await finish(page)).map(e => e[4])).toEqual([14, 15, 14]);
});

test("full-viewport region samples remain inside the far viewport edges", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 80 });
    await start(page);
    await page.locator("#region").evaluate(e => {
        (e as HTMLElement).style.cssText = "position:fixed;inset:0;width:320px;height:80px";
    });
    await page.waitForTimeout(180);
    await pane(page);
    await page.locator("#modal").evaluate(e => {
        (e as HTMLElement).style.cssText = "position:fixed;inset:0;background:white;z-index:999";
    });
    await page.waitForTimeout(250);
    expect((await finish(page)).map(e => e[4])).toEqual([14, 15]);
});

test("shadow color transition starts coverage only after nonzero paint is observed", async ({ page }) => {
    await start(page);
    await pane(page, { shadow: true, background: "transparent" });
    await page.waitForTimeout(180);
    const changed = await page.locator("#modal").evaluate(e => {
        const element = e as HTMLElement;
        element.style.transition = "background-color 900ms linear";
        element.getBoundingClientRect();
        element.style.backgroundColor = "white";
        return performance.now() - window.regionStart;
    });
    await page.waitForTimeout(350);
    const events = await finish(page);
    expect(events.map(e => e[4])).toEqual([14, 15]);
    expect(Number(events[1][0])).toBeGreaterThanOrEqual(Math.floor(changed));
    expect(Number(events[1][0]) - changed).toBeLessThan(250);
});
