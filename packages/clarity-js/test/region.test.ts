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
        body: '<!doctype html><style>body{margin:0}#region{position:absolute;left:100px;top:100px;width:300px;height:200px;background:blue;z-index:0}</style><div id="region" data-clarity-region="content"></div>'
    }));
    await page.goto("https://region.test/");
    await page.addScriptTag({ path: join(__dirname, `../build/clarity.${build === "extended" ? "extended" : "min"}.js`) });
    await page.evaluate(() => {
        window.regionEvents = []; window.regionStart = performance.now();
        const clarity: unknown = Reflect.get(window, "clarity");
        if (typeof clarity !== "function") { throw new Error("Missing Clarity"); }
        clarity("start", { projectId: "regions", track: false, delay: 100,
            upload: (payload: string): void => { window.regionEvents.push(...JSON.parse(payload).a); } });
    });
    await page.waitForTimeout(250);
}
async function pane(page: Page, mode: string = "aria"): Promise<void> {
    await page.evaluate(value => {
        let root: HTMLElement | ShadowRoot = document.body;
        if (value === "shadow") {
            const host = document.createElement("section"); root.append(host);
            root = host.attachShadow({ mode: "open" });
        }
        const dialog = document.createElement(value === "native" ? "dialog" : "div");
        dialog.id = "modal"; dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true");
        dialog.style.cssText = value === "native" || value === "shadow" ?
            "position:fixed;left:500px;top:100px;width:100px;height:100px;margin:0;padding:0;border:0;background:white;z-index:999" :
            "position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:999";
        root.append(dialog);
        if (value === "shadow") {
            const backdrop = document.createElement("div");
            backdrop.id = "backdrop"; backdrop.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:998";
            root.append(backdrop);
        }
        if (dialog instanceof HTMLDialogElement) { dialog.showModal(); }
    }, mode);
}
async function finish(page: Page): Promise<(number | string)[][]> {
    await page.evaluate(() => {
        const clarity: unknown = Reflect.get(window, "clarity");
        if (typeof clarity !== "function") { throw new Error("Missing Clarity"); }
        clarity("event", "fixture-end");
        clarity("stop");
    });
    return page.evaluate(() => window.regionEvents.filter(e => e[1] === 7 && e[5] === "content" && Number(e[4]) >= 14));
}
async function visibility(page: Page, value: string): Promise<void> {
    await page.evaluate(state => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
        document.dispatchEvent(new Event("visibilitychange"));
    }, value);
}

for (const mode of ["aria", "native", "shadow"]) {
    test(`full-page ${mode} appearance/removal balances background exposure`, async ({ page }) => {
        await start(page); await pane(page, mode); await page.waitForTimeout(200);
        await page.locator("#modal").evaluate(e => e.remove());
        await page.waitForTimeout(200);
        expect((await finish(page)).map(e => e[4])).toEqual([14, 15, 14]);
    });
}

for (const style of ["width:300px;height:200px;left:100px;top:100px;right:auto;bottom:auto",
    "border-radius:10px", "padding:40px;background-clip:content-box", "transform:scale(.9)", "clip:rect(0px,100px,100px,0px)",
    "background:transparent", "z-index:-1"]) {
    test(`unverified or non-full-page surface retains exposure: ${style}`, async ({ page }) => {
        await start(page); await pane(page);
        await page.locator("#modal").evaluate((e, value) => (e as HTMLElement).style.cssText += ";" + value, style);
        await page.waitForTimeout(200);
        expect((await finish(page)).map(e => e[4])).toEqual([14]);
    });
}

test("pointer-events:none still counts proven painted full-page cover", async ({ page }) => {
    await start(page); await pane(page);
    await page.locator("#modal").evaluate(e => (e as HTMLElement).style.pointerEvents = "none");
    await page.waitForTimeout(200);
    expect((await finish(page)).map(e => e[4])).toEqual([14, 15]);
});

test("foreground island without enclosing context cannot falsely exit", async ({ page }) => {
    await start(page);
    await page.locator("#region").evaluate(e => {
        const region = e as HTMLElement; region.style.zIndex = "auto";
        const child = document.createElement("div");
        child.id = "island";
        child.style.cssText = "position:absolute;left:70px;top:30px;width:20px;height:20px;background:blue;z-index:1000";
        region.append(child);
    });
    await pane(page); await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.elementFromPoint(180, 140).id)).toBe("island");
    expect((await finish(page)).map(e => e[4])).toEqual([14]);
});

test("enclosing lower stacking context confines a high-z descendant", async ({ page }) => {
    await start(page);
    await page.locator("#region").evaluate(e => {
        const child = document.createElement("div");
        child.style.cssText = "position:absolute;inset:0;background:blue;z-index:10000";
        e.append(child);
    });
    await pane(page); await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.elementFromPoint(180, 140).id)).toBe("modal");
    expect((await finish(page)).map(e => e[4])).toEqual([14, 15]);
});

test("native modal escapes clipped and transparent DOM ancestors", async ({ page }) => {
    await start(page);
    await page.evaluate(() => {
        const host = document.createElement("div");
        host.style.cssText = "position:absolute;width:20px;height:20px;overflow:hidden;opacity:0";
        document.body.append(host);
        const dialog = document.createElement("dialog"); dialog.id = "modal";
        dialog.textContent = "Dialog"; host.append(dialog); dialog.showModal();
    });
    await page.waitForTimeout(250);
    expect((await finish(page)).map(e => e[4])).toEqual([14, 15]);
});

for (const foregroundName of ["content", "foreground"]) {
test(`native foreground and nested covers balance region instances: ${foregroundName}`, async ({ page }) => {
    await start(page); await pane(page, "native");
    await page.locator("#modal").evaluate((e, name) => {
        e.innerHTML = `<div data-clarity-region="${name}"><button id="button">Continue</button><input id="input"></div>`;
    }, foregroundName);
    await page.waitForTimeout(250);
    await page.click("#button"); await page.fill("#input", "test"); await page.press("#input", "Enter");
    await expect.poll(() => page.evaluate(() => window.regionEvents.some(e => e[1] === 27))).toBe(true);
    await page.evaluate(() => {
        const nested = document.createElement("dialog"); nested.id = "nested"; nested.textContent = "Nested";
        document.body.append(nested); nested.showModal();
    });
    await page.waitForTimeout(180);
    await page.locator("#modal").evaluate(e => (e as HTMLDialogElement).close());
    await page.waitForTimeout(180);
    await page.locator("#nested").evaluate(e => (e as HTMLDialogElement).close());
    await page.waitForTimeout(180);
    const events = await finish(page);
    const backgroundId = events[0][2];
    expect(events.filter(e => e[2] === backgroundId).map(e => e[4])).toEqual([14, 15, 14]);
    const instances = await page.evaluate(() => window.regionEvents.filter(e => e[1] === 7 && e[4] === 14));
    expect(instances.some(e => e[2] !== backgroundId && e[5] === foregroundName)).toBe(true);
    const factual = await page.evaluate(() => window.regionEvents.map(e => e[1]));
    expect(factual).toContain(9); expect(factual).toContain(27);
    console.log("Same-name background/foreground instance events:", events);
    console.log("NATIVE_WIRE", JSON.stringify(await page.evaluate(name => ({
        scenario: `${name}-nested`, events: window.regionEvents.filter(e => [7, 9, 12, 24, 27, 28].includes(Number(e[1])))
    }), foregroundName)));
});
}

for (const removed of [true, false]) {
    test(`cover dismissal does not reenter ${removed ? "removed" : "offscreen"} background`, async ({ page }) => {
        await start(page); await pane(page, "native"); await page.waitForTimeout(180);
        await page.locator("#region").evaluate((e, remove) => {
            if (remove) { e.remove(); } else { (e as HTMLElement).style.top = "1000px"; }
        }, removed);
        await page.waitForTimeout(180);
        await page.locator("#modal").evaluate(e => (e as HTMLDialogElement).close());
        await page.waitForTimeout(180);
        expect((await finish(page)).map(e => e[4])).toEqual([14, 15]);
    });
}

test("tab hidden/resume alone does not split a visit", async ({ page }) => {
    await start(page); await visibility(page, "hidden"); await page.waitForTimeout(180); await visibility(page, "visible");
    expect((await finish(page)).map(e => e[4])).toEqual([14]);
    expect(await page.evaluate(() => window.regionEvents.filter(e => e[1] === 28).map(e => e[2]))).toEqual([1, 0, 1]);
    console.log("NATIVE_WIRE", JSON.stringify(await page.evaluate(() => ({
        scenario: "hidden-resume", events: window.regionEvents.filter(e => [7, 24, 28].includes(Number(e[1])))
    }))));
});

for (const dismissed of [true, false]) {
    test(`cover during hidden is reconciled only at resume, dismissed=${dismissed}`, async ({ page }) => {
        await start(page); await visibility(page, "hidden"); await pane(page);
        await page.locator("#region").evaluate(e => (e as HTMLElement).style.left = "-10px");
        await page.waitForTimeout(180);
        if (dismissed) { await page.locator("#modal").evaluate(e => e.remove()); }
        await visibility(page, "visible"); await page.waitForTimeout(180);
        expect((await finish(page)).map(e => e[4])).toEqual(dismissed ? [14] : [14, 15]);
    });
}

test("normal build does not gain viewport or modal tracking", async ({ page }) => {
    await start(page, "normal"); await pane(page); await page.waitForTimeout(180);
    expect(await finish(page)).toEqual([]);
});

test("static full-page coverage does not poll or hit-test; stop removes callbacks", async ({ page }) => {
    await start(page);
    await page.locator("#region").evaluate(e => {
        for (let i = 1; i < 20; i++) {
            const node = e.cloneNode(true) as HTMLElement; node.id = `region${i}`;
            node.style.cssText = "position:absolute;left:100px;top:100px;width:300px;height:200px;z-index:0";
            e.parentNode.appendChild(node);
        }
    });
    await pane(page); await page.waitForTimeout(250);
    const measurements = await page.evaluate(async () => {
        let reads = 0, hits = 0;
        const bounds = Element.prototype.getBoundingClientRect;
        const hit = document.elementsFromPoint;
        Element.prototype.getBoundingClientRect = function(): DOMRect { reads++; return bounds.call(this); };
        document.elementsFromPoint = function(x: number, y: number): Element[] { hits++; return hit.call(this, x, y); };
        await new Promise(resolve => setTimeout(resolve, 300));
        const idle = reads;
        for (let i = 0; i < 100; i++) { document.body.setAttribute("data-burst", String(i)); }
        await new Promise(resolve => setTimeout(resolve, 200));
        Element.prototype.getBoundingClientRect = bounds; document.elementsFromPoint = hit;
        return { idle, burst: reads - idle, hits };
    });
    expect(measurements.idle).toBe(0); expect(measurements.hits).toBe(0);
    expect(measurements.burst).toBeLessThanOrEqual(4);
    console.log("Full-page detector work:", measurements);
    await finish(page);
    const afterStop = await page.evaluate(async () => {
        let reads = 0;
        const original = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function(): DOMRect { reads++; return original.call(this); };
        document.querySelector("#modal").remove();
        window.dispatchEvent(new Event("resize"));
        document.dispatchEvent(new Event("transitionend", { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 200));
        Element.prototype.getBoundingClientRect = original;
        return reads;
    });
    expect(afterStop).toBe(0);
});

test("pointer targets after cover do not reuse stale background identity", async ({ page }) => {
    await start(page);
    await page.mouse.move(150, 150);
    await pane(page);
    await page.waitForTimeout(200);
    await page.mouse.move(180, 160); await page.mouse.click(180, 160);
    await page.waitForTimeout(250);
    const regions = await finish(page);
    const background = regions[0][2], exit = Number(regions.find(e => e[4] === 15)[0]);
    const pointers = await page.evaluate(() => window.regionEvents.filter(e => e[1] === 12 || e[1] === 9));
    expect(pointers.some(e => Number(e[0]) > exit)).toBe(true);
    expect(pointers.filter(e => Number(e[0]) > exit && e[2] === background)).toEqual([]);
    expect(regions.map(e => e[4])).toEqual([14, 15]);
    console.log("Pointer timestamps/targets around cover:", pointers.map(e => [e[0], e[1], e[2], e[e.length - 1]]));
    console.log("NATIVE_WIRE", JSON.stringify(await page.evaluate(() => ({
        scenario: "pointer-cover", events: window.regionEvents.filter(e => [7, 9, 12, 24, 28].includes(Number(e[1])))
    }))));
});

test("native cover does not suppress an unverified popover in the top layer", async ({ page }) => {
    await start(page); await pane(page, "native"); await page.waitForTimeout(180);
    await page.evaluate(() => {
        const popover = document.createElement("div"); popover.setAttribute("popover", "manual");
        popover.textContent = "Foreground"; document.querySelector("#region").append(popover);
        const show: unknown = Reflect.get(popover, "showPopover");
        if (typeof show !== "function") { throw new Error("Popover API unavailable"); }
        show.call(popover);
    });

    await page.waitForTimeout(180);
    expect((await finish(page)).map(e => e[4])).toEqual([14, 15, 14]);
});

test("repeat start/stop does not keep old cover or duplicate region transitions", async ({ page }) => {
    await start(page); await pane(page); await page.waitForTimeout(200);
    expect((await finish(page)).map(e => e[4])).toEqual([14, 15]);
    await page.locator("#modal").evaluate(e => e.remove());
    await page.evaluate(() => {
        window.regionEvents = [];
        const clarity: unknown = Reflect.get(window, "clarity");
        if (typeof clarity !== "function") { throw new Error("Missing Clarity"); }
        clarity("start", { projectId: "regions", track: false, delay: 100,
            upload: (payload: string): void => { window.regionEvents.push(...JSON.parse(payload).a); } });
    });
    await page.waitForTimeout(200); await pane(page); await page.waitForTimeout(200);
    await page.locator("#modal").evaluate(e => e.remove()); await page.waitForTimeout(200);
    expect((await finish(page)).map(e => e[4])).toEqual([14, 15, 14]);
});

test("frame-local native dialog does not suppress main-document regions", async ({ page }) => {
    await start(page);
    await page.evaluate(() => {
        const frame = document.createElement("iframe");
        frame.style.cssText = "position:absolute;left:900px;width:800px;height:600px";
        frame.srcdoc = '<dialog>Frame dialog</dialog><script>document.querySelector("dialog").showModal()</script>';
        document.body.append(frame);
    });
    await page.waitForTimeout(300);
    expect((await finish(page)).map(e => e[4])).toEqual([14]);
});

test("ARIA cover cannot outrank a native foreground island inside a background region", async ({ page }) => {
    await start(page); await pane(page); await page.waitForTimeout(180);
    await page.locator("#region").evaluate(e => {
        const host = document.createElement("section"); e.append(host);
        const shadow = host.attachShadow({ mode: "open" });
        const dialog = document.createElement("dialog"); dialog.textContent = "Foreground";
        shadow.append(dialog); dialog.showModal();
    });
    await page.waitForTimeout(250);
    expect((await finish(page)).map(e => e[4])).toEqual([14, 15, 14]);
});
