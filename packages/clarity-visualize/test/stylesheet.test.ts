import { expect, test } from "@playwright/test";
import { resolve } from "path";
import { loadStylesheet } from "../src/stylesheet";
import type { StylesheetOutcome } from "../types/visualize";

test.describe("stylesheet loading", () => {
    test("reports loading independently of CSSOM access or transformation", async () => {
        const link = createLink();
        Object.defineProperty(link, "sheet", { get: (): never => { throw new Error("SecurityError"); } });
        const load = loadStylesheet(link, "https://provider.invalid/cached.css", 1000, noReplace, true);
        const onload = link.onload;

        fire(onload);
        fire(onload);
        expect(await load.ready).toEqual({ status: "loaded", fallback: false, link });
        expect(link.onload).toBeNull();
        expect(link.onerror).toBeNull();
    });

    test("retries the exact provider URL once without CORS or integrity", async () => {
        const link = createLink({ integrity: "recorded" });
        const providerUrl = "https://provider.invalid/cached.css";
        let fallback: HTMLLinkElement = null;
        let replacements = 0;
        const load = loadStylesheet(link, providerUrl, 1000,
            (_failed: HTMLLinkElement, replacement: HTMLLinkElement): void => {
                replacements++;
                fallback = replacement;
            }, true);
        fire(link.onerror);

        expect(fallback.href).toBe(providerUrl);
        expect(fallback.hasAttribute("crossorigin")).toBe(false);
        expect(fallback.hasAttribute("integrity")).toBe(false);
        fire(fallback.onload);
        expect(await load.ready).toEqual({ status: "loaded", fallback: true, link: fallback });
        expect(replacements).toBe(1);
    });

    test("ignores stale callbacks after retry and terminal failure", async () => {
        const link = createLink();
        let fallback: HTMLLinkElement = null;
        const load = loadStylesheet(link, "https://provider.invalid/cached.css", 1000,
            (_failed: HTMLLinkElement, replacement: HTMLLinkElement): void => { fallback = replacement; }, true);
        const firstLoad = link.onload;
        fire(link.onerror);
        fire(firstLoad);
        fire(fallback.onerror);
        expect(await load.ready).toEqual({ status: "failed", fallback: true, link: fallback });
    });

    test("gives both attempts independent timeouts", async () => {
        const link = createLink();
        let fallback: HTMLLinkElement = null;
        const load = loadStylesheet(link, "https://provider.invalid/cached.css", 10,
            (_failed: HTMLLinkElement, replacement: HTMLLinkElement): void => { fallback = replacement; }, true);

        expect(await load.ready).toEqual({ status: "failed", fallback: true, link: fallback });
        expect(fallback).not.toBeNull();
    });

    for (const retry of [false, true]) {
        test(`cancels ${retry ? "fallback" : "initial"} attempts without replacing newer mutations`, async () => {
            let link = createLink();
            let replacements = 0;
            const load = loadStylesheet(link, "https://provider.invalid/old.css", 10,
                (_failed: HTMLLinkElement, replacement: HTMLLinkElement): void => {
                    replacements++;
                    link = replacement;
                }, true);
            if (retry) { fire(link.onerror); }
            const staleLoad = link.onload;
            const staleError = link.onerror;
            load.cancel();
            load.cancel();
            link.href = "https://provider.invalid/new.css";
            fire(staleLoad);
            fire(staleError);
            await new Promise((done: () => void): ReturnType<typeof setTimeout> => setTimeout(done, 30));

            expect(await load.ready).toEqual({ status: "cancelled", fallback: retry, link });
            expect(link.href).toBe("https://provider.invalid/new.css");
            expect(replacements).toBe(retry ? 1 : 0);
        });
    }

    test("does not retry ordinary links", async () => {
        const link = createLink();
        const load = loadStylesheet(link, "https://provider.invalid/cached.css", 1000, noReplace);
        fire(link.onerror);
        expect(await load.ready).toEqual({ status: "failed", fallback: false, link });
        expect(link.crossOrigin).toBeNull();
    });
});

test.describe("replay stylesheet lifecycle", () => {
    test.beforeEach(async ({ page }) => {
        await page.addScriptTag({ path: resolve(__dirname, "..", "build", "clarity.visualize.min.js") });
    });

    for (const changeHref of [false, true]) {
        test(`disables and re-enables a stylesheet ${changeHref ? "with a new resource" : "in place"}`, async ({ page }) => {
            const result = await page.evaluate(async (replace: boolean) => {
                const api = (window as Window & { clarity: { visualize: typeof import("../src/clarity") } }).clarity.visualize;
                const proxyCalls: string[] = [];
                const visualizer = await api.setup(window, {
                    version: "0.8.72",
                    corsProxyStylesheets: true,
                    useproxy: (url: string): string => {
                        proxyCalls.push(url);
                        return url;
                    }
                });
                const layout = visualizer.layout;
                layout.nodes[1] = document.head;
                const node = {
                    id: 2, parent: 1, previous: null, tag: "LINK",
                    attributes: { rel: "stylesheet", href: "data:text/css,.target%7Bcolor:blue%7D" }
                };
                await layout.dom({ event: 6, time: 0, data: [node] });
                const link = layout.element(2) as HTMLLinkElement;
                const sheet = link.sheet;
                const target = document.createElement("div");
                target.className = "target";
                document.body.appendChild(target);
                layout.markup({ event: 6, time: 1, data: [{
                    ...node, attributes: { ...node.attributes, class: "updated" }
                }] });
                const attributeUpdate = {
                    sameLink: layout.element(2) === link,
                    sameSheet: link.sheet === sheet,
                    promises: layout.stylesheets.length,
                    proxyCalls: proxyCalls.length,
                    className: link.className
                };
                const href = replace ? "data:text/css,.target%7Bcolor:red%7D" : node.attributes.href;
                layout.markup({ event: 6, time: 2, data: [{
                    ...node, attributes: { rel: "stylesheet", href, disabled: "" }
                }] });
                const disabled = {
                    sameLink: layout.element(2) === link,
                    disabled: link.disabled,
                    color: getComputedStyle(target).color,
                    promises: layout.stylesheets.length,
                    links: document.querySelectorAll('link[rel="stylesheet"]').length
                };
                await layout.dom({ event: 6, time: 3, data: [{
                    ...node, attributes: { rel: "stylesheet", href }
                }] });
                return {
                    attributeUpdate, disabled,
                    enabled: {
                        sameLink: layout.element(2) === link,
                        disabled: link.disabled,
                        color: getComputedStyle(target).color,
                        visibility: document.documentElement.style.visibility
                    }
                };
            }, changeHref);

            expect(result.attributeUpdate).toEqual({
                sameLink: true, sameSheet: true, promises: 1, proxyCalls: 1, className: "updated"
            });
            expect(result.disabled).toEqual({
                sameLink: true, disabled: true, color: "rgb(0, 0, 0)", promises: 1, links: 1
            });
            expect(result.enabled).toEqual({
                sameLink: true, disabled: false,
                color: changeHref ? "rgb(255, 0, 0)" : "rgb(0, 0, 255)", visibility: "visible"
            });
        });
    }

    test("preserves transformed hover styling when media attributes rebuild CSSOM", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const api = (window as Window & { clarity: { visualize: typeof import("../src/clarity") } }).clarity.visualize;
            const visualizer = await api.setup(window, {
                version: "0.8.72", corsProxyStylesheets: true, useproxy: (url: string): string => url
            });
            const layout = visualizer.layout;
            layout.nodes[1] = document.head;
            const node = {
                id: 2, parent: 1, previous: null, tag: "LINK",
                attributes: { rel: "stylesheet", href: "data:text/css,.target:hover%7Bcolor:red%7D" }
            };
            await layout.dom({ event: 6, time: 0, data: [node] });
            const link = layout.element(2);
            layout.markup({ event: 6, time: 1, data: [{ ...node, attributes: { ...node.attributes, media: "all" } }] });
            const target = document.createElement("div");
            target.className = "target";
            target.setAttribute("clarity-hover", "");
            document.body.appendChild(target);
            return { sameLink: layout.element(2) === link, color: getComputedStyle(target).color, promises: layout.stylesheets.length };
        });

        expect(result).toEqual({ sameLink: true, color: "rgb(255, 0, 0)", promises: 1 });
    });

    for (const scenario of ["cors", "fallback", "reset", "preload"]) {
        test(`waits for replacement resources before revealing replay (${scenario})`, async ({ page }) => {
            let requests = 0;
            let release: () => void;
            const response = new Promise<void>((done): void => { release = done; });
            await page.route("https://styles.invalid/initial.css", async (route) => { await route.abort("failed"); });
            await page.route("https://styles.invalid/replacement.css", async (route) => {
                requests++;
                if (scenario === "fallback" && requests === 1) {
                    await route.abort("failed");
                    return;
                }
                await response;
                await route.fulfill({
                    contentType: "text/css",
                    headers: { "Access-Control-Allow-Origin": "*" },
                    body: ".target { color: rgb(255, 0, 0); }"
                });
            });
            try {
                await page.evaluate(async (mode: string) => {
                    const api = (window as Window & { clarity: { visualize: typeof import("../src/clarity") } }).clarity.visualize;
                    const visualizer = await api.setup(window, {
                        version: "0.8.72", corsProxyStylesheets: true, useproxy: (url: string): string => url
                    });
                    const layout = visualizer.layout;
                    layout.nodes[1] = document.head;
                    const node = {
                        id: 2, parent: 1, previous: null, tag: "LINK",
                        attributes: { rel: "stylesheet", href: "https://styles.invalid/initial.css" }
                    };
                    const initial = layout.dom({ event: 6, time: 0, data: [node] });
                    const replacement = {
                        ...node,
                        id: mode === "preload" ? 3 : 2,
                        attributes: {
                            rel: mode === "preload" ? "preload" : "stylesheet",
                            as: mode === "preload" ? "style" : undefined,
                            href: "https://styles.invalid/replacement.css"
                        }
                    };
                    let ready = initial;
                    if (mode === "reset") {
                        layout.reset();
                        layout.nodes[1] = document.head;
                        ready = layout.dom({ event: 6, time: 1, data: [replacement] });
                    } else {
                        if (mode === "preload") {
                            layout.markup({ event: 6, time: 1, data: [{ ...node, parent: null }] });
                        }
                        layout.markup({ event: 6, time: 1, data: [replacement] });
                    }
                    void ready.then((): void => { document.documentElement.dataset.ready = "true"; });
                    const target = document.createElement("div");
                    target.className = "target";
                    document.body.appendChild(target);
                    await new Promise<void>((done): void => { setTimeout(done, 0); });
                }, scenario);
                await expect.poll(() => requests).toBe(scenario === "fallback" ? 2 : 1);
                expect(await page.evaluate(() => ({
                    visibility: document.documentElement.style.visibility,
                    ready: document.documentElement.dataset.ready
                }))).toEqual({ visibility: "hidden", ready: undefined });
                release();
                await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
                await expect(page.locator("html")).toHaveCSS("visibility", "visible");
                if (scenario !== "preload") {
                    await expect(page.locator(".target")).toHaveCSS("color", "rgb(255, 0, 0)");
                }
            } finally {
                release();
            }
        });
    }

    for (const succeeds of [true, false]) {
        test(`keeps applied styling through a ${succeeds ? "successful" : "failed"} CORS fallback`, async ({ page }) => {
            let requests = 0;
            let release: () => void;
            const retry = new Promise<void>((resolveRetry): void => { release = resolveRetry; });
            await page.route("https://styles.invalid/replacement.css", async (route) => {
                requests++;
                if (requests === 1) {
                    await route.abort("failed");
                    return;
                }
                await retry;
                if (succeeds) {
                    await route.fulfill({ contentType: "text/css", body: ".target { color: rgb(255, 0, 0); }" });
                } else {
                    await route.abort("failed");
                }
            });
            await page.evaluate(async () => {
                const api = (window as Window & { clarity: { visualize: typeof import("../src/clarity") } }).clarity.visualize;
                const visualizer = await api.setup(window, {
                    version: "0.8.72", corsProxyStylesheets: true, useproxy: (url: string): string => url
                });
                const layout = visualizer.layout;
                layout.nodes[1] = document.head;
                const node = {
                    id: 2, parent: 1, previous: null, tag: "LINK",
                    attributes: { rel: "stylesheet", href: "data:text/css,.target%7Bcolor:rgb(0,0,255)%7D" }
                };
                layout.markup({ event: 6, time: 0, data: [node] });
                await Promise.all(layout.stylesheets);
                const target = document.createElement("div");
                target.className = "target";
                document.body.appendChild(target);
                layout.markup({ event: 6, time: 1, data: [{
                    ...node, attributes: { rel: "stylesheet", href: "https://styles.invalid/replacement.css" }
                }] });
            });
            try {
                await expect.poll(() => requests).toBe(2);
                await expect(page.locator(".target")).toHaveCSS("color", "rgb(0, 0, 255)");
                await expect(page.locator('link[rel="stylesheet"]')).toHaveCount(2);
                release();
                await expect(page.locator('link[rel="stylesheet"]')).toHaveCount(1);
                await expect(page.locator(".target")).toHaveCSS("color", succeeds ? "rgb(255, 0, 0)" : "rgb(0, 0, 255)");
            } finally {
                release();
            }
        });
    }

    test("transforms a loaded stylesheet and applies replay hover styling", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const api = (window as Window & { clarity: { visualize: typeof import("../src/clarity") } }).clarity.visualize;
            const outcomes: StylesheetOutcome[] = [];
            const visualizer = await api.setup(window, {
                version: "0.8.72",
                corsProxyStylesheets: true,
                useproxy: (url: string): string => url,
                onstylesheet: (outcome: StylesheetOutcome): void => { outcomes.push(outcome); }
            });
            const layout = visualizer.layout;
            layout.nodes[1] = document.head;
            layout.markup({ event: 6, time: 0, data: [{
                id: 2, parent: 1, previous: null, tag: "LINK",
                attributes: { rel: "stylesheet", href: "data:text/css,.target:hover%7Bcolor:red%7D" }
            }] });
            const target = document.createElement("div");
            target.className = "target";
            target.setAttribute("clarity-hover", "");
            document.body.appendChild(target);
            await Promise.all(layout.stylesheets);
            return { outcomes, color: getComputedStyle(target).color };
        });

        expect(result.outcomes).toEqual([{
            status: "loaded-readable",
            fallback: false,
            transformation: { scanned: 1, hover: 1, transformed: 1, partial: 0, unsupported: 0, parseFailed: 0, insertionFailed: 0 }
        }]);
        expect(result.color).toBe("rgb(255, 0, 0)");
    });

    for (const scenario of ["empty", "insertion-failure", "unexpected", "unavailable", "fallback"]) {
        test(`preserves successful loading for a ${scenario} stylesheet`, async ({ page }) => {
            const result = await page.evaluate(async (mode: string) => {
                const api = (window as Window & { clarity: { visualize: typeof import("../src/clarity") } }).clarity.visualize;
                const outcomes: StylesheetOutcome[] = [];
                const errors: string[] = [];
                const visualizer = await api.setup(window, {
                    version: "0.8.72",
                    corsProxyStylesheets: true,
                    useproxy: (url: string): string => url,
                    onstylesheet: (outcome: StylesheetOutcome): void => { outcomes.push(outcome); },
                    logerror: (error: Error): void => { errors.push(error.message); }
                });
                const layout = visualizer.layout;
                layout.nodes[1] = document.head;
                const rendering = layout.dom({ event: 6, time: 0, data: [{
                    id: 2, parent: 1, previous: null, tag: "LINK",
                    attributes: { rel: "stylesheet", href: "data:text/css,.target:hover%7Bcolor:red%7D" }
                }] });
                let link = layout.element(2) as HTMLLinkElement;
                if (mode === "fallback") {
                    link.dispatchEvent(new Event("error"));
                    link = layout.element(2) as HTMLLinkElement;
                    Object.defineProperty(link, "sheet", {
                        get(): never { throw new Error("Fallback CSSOM must not be inspected"); }
                    });
                } else if (mode === "unavailable") {
                    Object.defineProperty(link, "sheet", { value: null });
                } else {
                    const sheet = new CSSStyleSheet();
                    if (mode === "insertion-failure") {
                        sheet.replaceSync(".target:hover { color: red; }");
                        sheet.insertRule = (): never => { throw new Error("Rule insertion failed"); };
                    } else if (mode === "unexpected") {
                        let reads = 0;
                        const rules = sheet.cssRules;
                        Object.defineProperty(sheet, "cssRules", {
                            get(): CSSRuleList {
                                if (++reads > 1) { throw new Error("Unexpected transformation error"); }
                                return rules;
                            }
                        });
                    }
                    Object.defineProperty(link, "sheet", { value: sheet });
                }
                link.dispatchEvent(new Event("load"));
                await rendering;
                return { outcomes, errors, visibility: document.documentElement.style.visibility };
            }, scenario);

            const readable = !["unavailable", "fallback"].includes(scenario);
            expect(result.visibility).toBe("visible");
            expect(result.outcomes).toHaveLength(1);
            expect(result.outcomes[0]).toMatchObject({
                status: readable ? "loaded-readable" : "loaded",
                fallback: scenario === "fallback"
            });
            if (scenario === "empty") {
                expect(result.outcomes[0].transformation).toEqual({
                    scanned: 0, hover: 0, transformed: 0, partial: 0, unsupported: 0, parseFailed: 0, insertionFailed: 0
                });
            } else if (scenario === "insertion-failure") {
                expect(result.outcomes[0].transformation).toMatchObject({ insertionFailed: 1, transformed: 0 });
            } else {
                expect(result.outcomes[0].transformation).toBeUndefined();
            }
            expect(result.errors).toEqual(scenario === "unexpected" ? ["Unexpected transformation error"]
                : scenario === "insertion-failure" ? ["Rule insertion failed"] : []);
        });
    }

    for (const fallback of [false, true]) {
        test(`removing a stylesheet cancels its ${fallback ? "fallback" : "initial"} load without restarting it`, async ({ page }) => {
            await page.clock.install();
            const state = await page.evaluateHandle(async (retry: boolean) => {
                const api = (window as Window & { clarity: { visualize: typeof import("../src/clarity") } }).clarity.visualize;
                const outcomes: StylesheetOutcome[] = [];
                const visualizer = await api.setup(window, {
                    version: "0.8.72",
                    corsProxyStylesheets: true,
                    useproxy: (url: string): string => url,
                    onstylesheet: (outcome: StylesheetOutcome): void => { outcomes.push(outcome); }
                });
                const layout = visualizer.layout;
                layout.nodes[1] = document.head;
                const node = {
                    id: 2, parent: 1, previous: null, tag: "LINK",
                    attributes: { rel: "stylesheet", href: "data:text/css,.old:hover%7Bcolor:red%7D" }
                };
                layout.markup({ event: 6, time: 0, data: [node] });
                if (retry) { layout.element(2).dispatchEvent(new Event("error")); }
                const link = layout.element(2) as HTMLLinkElement;
                const pending = layout.stylesheets[0];
                layout.markup({ event: 6, time: 1, data: [{ ...node, parent: null }] });
                await pending;
                return { layout, link, outcomes };
            }, fallback);

            await page.clock.runFor(14001);
            const result = await state.evaluate(({ layout, link, outcomes }) => ({
                promises: layout.stylesheets.length,
                sameLink: layout.element(2) === link,
                connected: link.isConnected,
                onload: link.onload,
                onerror: link.onerror,
                outcomes
            }));

            expect(result).toEqual({
                promises: 1,
                sameLink: true,
                connected: false,
                onload: null,
                onerror: null,
                outcomes: []
            });
            await state.dispose();
        });
    }

    for (const change of ["href", "rel", "reset", "fallback", "completed"]) {
        test(`a stale load cannot overwrite a ${change} mutation`, async ({ page }) => {
            const result = await page.evaluate(async (mutation: string) => {
                const api = (window as Window & { clarity: { visualize: typeof import("../src/clarity") } }).clarity.visualize;
                const outcomes: StylesheetOutcome[] = [];
                const visualizer = await api.setup(window, {
                    version: "0.8.72",
                    corsProxyStylesheets: true,
                    useproxy: (url: string): string => url,
                    onstylesheet: (outcome: StylesheetOutcome): void => { outcomes.push(outcome); }
                });
                const layout = visualizer.layout;
                layout.nodes[1] = document.head;
                const node = {
                    id: 2, parent: 1, previous: null, tag: "LINK",
                    attributes: { rel: "stylesheet", href: "data:text/css,.old:hover%7Bcolor:red%7D" }
                };
                layout.markup({ event: 6, time: 0, data: [node] });
                let old = layout.element(2) as HTMLLinkElement;
                if (mutation === "fallback") {
                    old.dispatchEvent(new Event("error"));
                    old = layout.element(2) as HTMLLinkElement;
                }
                const staleLoad = old.onload;
                const staleError = old.onerror;
                const pending = layout.stylesheets[0];
                if (mutation === "completed") { old.dispatchEvent(new Event("load")); }
                if (mutation === "reset") {
                    layout.reset();
                } else {
                    layout.markup({ event: 6, time: 1, data: [{
                        ...node,
                        parent: 1,
                        attributes: {
                            rel: mutation === "rel" ? "alternate" : "stylesheet",
                            href: "data:text/css,.new:hover%7Bcolor:blue%7D"
                        }
                    }] });
                }
                const current = layout.element(2);
                staleError.call(old, new Event("error"));
                staleLoad.call(old, new Event("load"));
                await pending;
                const unchanged = layout.element(2) === current;
                const href = (current as HTMLLinkElement)?.href;
                const reports = outcomes.length;
                layout.reset();
                return { unchanged, href, reports };
            }, change);

            expect(result.unchanged).toBe(true);
            expect(result.reports).toBe(0);
            if (change !== "reset") { expect(result.href).toContain(".new:hover"); }
        });
    }

    for (const access of ["sheet", "cssRules"]) {
        test(`reports a loaded stylesheet without logging ${access} access errors`, async ({ page }) => {
            const result = await page.evaluate(async (property: string) => {
                const api = (window as Window & { clarity: { visualize: typeof import("../src/clarity") } }).clarity.visualize;
                const outcomes: StylesheetOutcome[] = [];
                const errors: string[] = [];
                const visualizer = await api.setup(window, {
                    version: "0.8.72",
                    corsProxyStylesheets: true,
                    useproxy: (url: string): string => url,
                    onstylesheet: (outcome: StylesheetOutcome): void => { outcomes.push(outcome); },
                    logerror: (error: Error): void => { errors.push(error.message); }
                });
                const layout = visualizer.layout;
                layout.nodes[1] = document.head;
                layout.markup({ event: 6, time: 0, data: [{
                    id: 2, parent: 1, previous: null, tag: "LINK",
                    attributes: { rel: "stylesheet", href: "data:text/css,.target:hover%7Bcolor:red%7D" }
                }] });
                const link = layout.element(2) as HTMLLinkElement;
                const unreadable = { get: (): never => { throw new DOMException("CSSOM unavailable", "SecurityError"); } };
                if (property === "sheet") {
                    Object.defineProperty(link, "sheet", unreadable);
                } else {
                    const sheet = {};
                    Object.defineProperty(sheet, "cssRules", unreadable);
                    Object.defineProperty(link, "sheet", { value: sheet });
                }
                link.dispatchEvent(new Event("load"));
                await Promise.all(layout.stylesheets);
                return { outcomes, errors, sameLink: layout.element(2) === link };
            }, access);

            expect(result.outcomes).toEqual([{ status: "loaded", fallback: false, transformation: undefined }]);
            expect(result.errors).toEqual([]);
            expect(result.sameLink).toBe(true);
        });
    }
});

interface MockLink {
    href: string;
    crossOrigin: string;
    onload: (event?: Event) => void;
    onerror: (event?: Event) => void;
    ownerDocument: {
        defaultView: {
            setTimeout: typeof setTimeout;
            clearTimeout: typeof clearTimeout;
        };
    };
    cloneNode(deep?: boolean): MockLink;
    hasAttribute(name: string): boolean;
    removeAttribute(name: string): void;
}

function createLink(initial: { [name: string]: string } = {}): HTMLLinkElement {
    const attributes = { ...initial };
    const link: MockLink = {
        href: "",
        crossOrigin: null,
        onload: null,
        onerror: null,
        ownerDocument: { defaultView: { setTimeout, clearTimeout } },
        cloneNode(): MockLink {
            return createLink({
                ...attributes,
                ...(link.href ? { href: link.href } : {}),
                ...(link.crossOrigin ? { crossorigin: link.crossOrigin } : {})
            }) as never as MockLink;
        },
        hasAttribute(name: string): boolean {
            return name in attributes;
        },
        removeAttribute(name: string): void {
            delete attributes[name];
            if (name === "href") { link.href = ""; }
            if (name === "crossorigin") { link.crossOrigin = null; }
        }
    };
    return link as never as HTMLLinkElement;
}

function fire(handler: (event?: Event) => void): void {
    handler();
}

function noReplace(): never {
    throw new Error("Unexpected stylesheet replacement");
}
