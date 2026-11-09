import { expect, test } from "@playwright/test";
import type { Route } from "@playwright/test";
import { resolve } from "path";
import { loadStylesheet } from "@src/stylesheet";
import type { StylesheetOutcome } from "@clarity-types/visualize";

test.describe("stylesheet loading", () => {
    test("reports loading independently of CSSOM access or transformation", async () => {
        const link = createLink();
        Object.defineProperty(link, "sheet", { get: (): never => { throw new Error("SecurityError"); } });
        const load = loadStylesheet(link, "https://provider.invalid/cached.css", 1000, noReplace, true);
        const onload = link.onload;

        fire(onload);
        fire(onload);
        expect(await load.completed).toEqual({ status: "loaded", fallback: false, link });
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
        expect(await load.completed).toEqual({ status: "loaded", fallback: true, link: fallback });
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
        expect(await load.completed).toEqual({ status: "failed", fallback: true, link: fallback });
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

            expect(await load.completed).toEqual({ status: "cancelled", fallback: retry, link });
            expect(link.href).toBe("https://provider.invalid/new.css");
            expect(replacements).toBe(retry ? 1 : 0);
        });
    }

    test("does not retry ordinary links", async () => {
        const link = createLink();
        const load = loadStylesheet(link, "https://provider.invalid/cached.css", 1000, noReplace);
        fire(link.onerror);
        expect(await load.completed).toEqual({ status: "failed", fallback: false, link });
        expect(link.crossOrigin).toBeNull();
    });

    for (const completion of ["load", "error", "cancel"]) {
        test(`keeps ordinary loads pending after readiness until ${completion}`, async () => {
            const link = createLink();
            const load = loadStylesheet(link, "https://provider.invalid/slow.css", 10, noReplace);
            let completed = false;
            const pending = load.completed.then((result): typeof result => {
                completed = true;
                return result;
            });
            await load.ready;

            expect(completed).toBe(false);
            expect(link.onload).not.toBeNull();
            expect(link.onerror).not.toBeNull();
            const staleLoad = link.onload;
            const staleError = link.onerror;
            if (completion === "cancel") {
                load.cancel();
            } else {
                fire(completion === "load" ? link.onload : link.onerror);
            }
            fire(staleLoad);
            fire(staleError);

            expect(await pending).toEqual({
                status: completion === "load" ? "loaded" : completion === "error" ? "failed" : "cancelled",
                fallback: false,
                link
            });
            expect(link.onload).toBeNull();
            expect(link.onerror).toBeNull();
        });
    }

    for (const completion of ["load", "error"]) {
        test(`settles a detached fallback load on ${completion}`, async () => {
            let link = createLink();
            const load = loadStylesheet(link, "https://provider.invalid/cached.css", 1000,
                (_failed: HTMLLinkElement, replacement: HTMLLinkElement): void => { link = replacement; }, true);
            fire(link.onerror);
            Object.defineProperty(link.ownerDocument, "defaultView", { value: null });

            const handler = completion === "load" ? link.onload : link.onerror;
            expect(() => fire(handler)).not.toThrow();

            expect(await load.completed).toEqual({
                status: completion === "load" ? "loaded" : "failed",
                fallback: true,
                link
            });
            expect(link.onload).toBeNull();
            expect(link.onerror).toBeNull();
            expect(() => load.cancel()).not.toThrow();
        });
    }
});

test.describe("replay stylesheet lifecycle", () => {
    test.beforeEach(async ({ page }) => {
        await page.addScriptTag({ path: resolve(__dirname, "..", "build", "clarity.visualize.min.js") });
    });

    test("keeps replacement replay hidden when setup cancels an earlier render", async ({ page }) => {
        let acceptReplacement: (route: Route) => void;
        const requested = new Promise<Route>((resolveRoute: (route: Route) => void): void => {
            acceptReplacement = resolveRoute;
        });
        await page.route("https://provider.invalid/old.css", (): void => undefined);
        await page.route("https://provider.invalid/replacement.css", acceptReplacement);
        const state = await page.evaluateHandle(async () => {
            const api = (window as Window & { clarity: { visualize: typeof import("@src/clarity") } }).clarity.visualize;
            const visualizer = await api.setup(window, { version: "0.8.72" });
            const oldLayout = visualizer.layout;
            oldLayout.nodes[1] = document.head;
            const earlier = oldLayout.dom({ event: 6, time: 0, data: [{
                id: 2, parent: 1, previous: null, tag: "LINK",
                attributes: { rel: "stylesheet", href: "https://provider.invalid/old.css" }
            }] });
            const replacement = api.setup(window, {
                version: "0.8.72",
                dom: { event: 5, time: 1, data: [
                    { id: 3, parent: null, previous: null, tag: "*D",
                        attributes: { name: "html", publicId: "", systemId: "" } },
                    { id: 4, parent: null, previous: null, tag: "HTML" },
                    { id: 5, parent: 4, previous: null, tag: "HEAD" },
                    { id: 6, parent: 5, previous: null, tag: "LINK",
                        attributes: { rel: "stylesheet", href: "https://provider.invalid/replacement.css" } }
                ] }
            });
            await earlier;
            return { replacement };
        });
        const route = await requested;

        expect(await page.evaluate(() => document.documentElement.style.visibility)).toBe("hidden");
        await route.fulfill({ contentType: "text/css", body: "html { color: rgb(255, 0, 0); }" });
        await state.evaluate(async ({ replacement }) => { await replacement; });
        expect(await page.evaluate(() => document.documentElement.style.visibility)).toBe("visible");
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).color)).toBe("rgb(255, 0, 0)");
        await state.dispose();
    });

    for (const mode of ["ordinary", "proxy", "cors"]) {
        test(`resolves ${mode} iframe stylesheets against the iframe base`, async ({ page }) => {
            await page.route("https://provider.invalid/**", (route: Route): Promise<void> =>
                route.fulfill({
                    contentType: "text/css",
                    headers: { "Access-Control-Allow-Origin": "*" },
                    body: ""
                }));
            const result = await page.evaluate(async (loading: string) => {
                const api = (window as Window & { clarity: { visualize: typeof import("@src/clarity") } }).clarity.visualize;
                const urls: string[] = [];
                const visualizer = await api.setup(window, {
                    version: "0.8.72",
                    corsProxyStylesheets: loading === "cors",
                    useproxy: loading === "ordinary" ? undefined : (url: string): string => {
                        urls.push(url);
                        return url;
                    }
                });
                const layout = visualizer.layout;
                const base = document.createElement("base");
                base.href = "https://provider.invalid/top/";
                document.head.appendChild(base);
                const iframe = document.createElement("iframe");
                document.body.appendChild(iframe);
                const doc = iframe.contentDocument;
                doc.head.innerHTML = '<base href="https://provider.invalid/frame/">';
                layout.nodes[1] = doc.head;
                const node = {
                    id: 2, parent: 1, previous: null, tag: "LINK",
                    attributes: { rel: "stylesheet", href: "site.css" }
                };
                layout.markup({ event: 6, time: 0, data: [node] });
                await Promise.all(layout.stylesheets);
                const link = layout.element(2) as HTMLLinkElement;
                const href = link.href;
                layout.reset();
                return { href, urls };
            }, mode);

            expect(result.href).toBe("https://provider.invalid/frame/site.css");
            expect(result.urls).toEqual(mode === "ordinary" ? [] : [
                "https://provider.invalid/frame/site.css"
            ]);
        });
    }

    test("gives both attempts independent timeouts", async ({ page }) => {
        await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
        await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
        let requests = 0;
        // Hold both requests so only the controlled clock can finish each attempt.
        await page.route("https://provider.invalid/slow.css", (): void => { requests++; });
        const state = await page.evaluateHandle(async () => {
            const api = (window as Window & { clarity: { visualize: typeof import("@src/clarity") } }).clarity.visualize;
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
                attributes: { rel: "stylesheet", href: "https://provider.invalid/slow.css" }
            }] });
            const pending = { settled: false };
            void layout.stylesheets[0].then((): void => { pending.settled = true; });
            return { layout, initial: layout.element(2), outcomes, pending };
        });
        await expect.poll(() => requests).toBe(1);

        await page.clock.runFor(6999);
        expect(await state.evaluate(({ layout, initial, outcomes, pending }) => ({
            initial: layout.element(2) === initial, outcomes, settled: pending.settled
        }))).toEqual({ initial: true, outcomes: [], settled: false });

        await page.clock.runFor(1);
        await expect.poll(() => requests).toBe(2);
        expect(await state.evaluate(({ layout, initial, outcomes, pending }) => ({
            initial: layout.element(2) === initial, outcomes, settled: pending.settled
        }))).toEqual({ initial: false, outcomes: [], settled: false });

        await page.clock.runFor(6999);
        expect(await state.evaluate(({ outcomes, pending }) => ({ outcomes, settled: pending.settled })))
            .toEqual({ outcomes: [], settled: false });

        await page.clock.runFor(1);
        expect(await state.evaluate(({ outcomes, pending }) => ({ outcomes, settled: pending.settled }))).toEqual({
            outcomes: [{ status: "failed", fallback: true, transformation: undefined }],
            settled: true
        });
        await page.clock.runFor(14000);
        expect(requests).toBe(2);
        expect(await state.evaluate(({ outcomes }) => outcomes)).toHaveLength(1);
        await state.evaluate(({ layout }) => layout.reset());
        await state.dispose();
    });

    test("applies an ordinary stylesheet that loads after replay becomes visible", async ({ page }) => {
        await page.route("https://provider.invalid/", (documentRoute: Route): Promise<void> =>
            documentRoute.fulfill({ contentType: "text/html", body: "<!doctype html><html><head></head><body></body></html>" }));
        await page.goto("https://provider.invalid/");
        await page.addScriptTag({ path: resolve(__dirname, "..", "build", "clarity.visualize.min.js") });
        await page.clock.install();
        let capture: (route: Route) => void;
        const requested = new Promise<Route>((accept: (requestRoute: Route) => void): void => { capture = accept; });
        await page.route("https://provider.invalid/slow.css", capture);
        const state = await page.evaluateHandle(async () => {
            const api = (window as Window & { clarity: { visualize: typeof import("@src/clarity") } }).clarity.visualize;
            const visualizer = await api.setup(window, { version: "0.8.72" });
            const layout = visualizer.layout;
            layout.nodes[1] = document.head;
            const target = document.createElement("div");
            target.className = "target";
            target.setAttribute("clarity-hover", "");
            document.body.appendChild(target);
            const rendering = layout.dom({ event: 6, time: 0, data: [{
                id: 2, parent: 1, previous: null, tag: "LINK",
                attributes: { rel: "stylesheet", href: "https://provider.invalid/slow.css" }
            }] });
            return { layout, rendering, link: layout.element(2) as HTMLLinkElement };
        });
        const route = await requested;
        await page.clock.runFor(7001);
        expect(await state.evaluate(async ({ rendering }) => {
            await rendering;
            return document.documentElement.style.visibility;
        })).toBe("visible");

        await route.fulfill({ contentType: "text/css", body: ".target:hover { color: red; }" });
        await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector(".target")).color))
            .toBe("rgb(255, 0, 0)");
        expect(await state.evaluate(({ link }) => ({ onload: link.onload, onerror: link.onerror })))
            .toEqual({ onload: null, onerror: null });
        await state.evaluate(({ layout }) => layout.reset());
        await state.dispose();
    });

    for (const scenario of [
        { removal: "iframe", mode: "ordinary" },
        { removal: "ancestor", mode: "cors" }
    ]) {
        test(`reveals replay after removing ${scenario.removal} during ${scenario.mode} loading without reset`, async ({ page }) => {
            // Keep the load pending so only its readiness timeout can reveal replay.
            await page.route("https://provider.invalid/pending.css", (): void => undefined);
            const state = await page.evaluateHandle(async ({ removed, loading }) => {
                const api = (window as Window & { clarity: { visualize: typeof import("@src/clarity") } }).clarity.visualize;
                const outcomes: StylesheetOutcome[] = [];
                const visualizer = await api.setup(window, {
                    version: "0.8.72",
                    corsProxyStylesheets: loading !== "ordinary",
                    useproxy: loading === "ordinary" ? undefined : (url: string): string => url,
                    onstylesheet: (outcome: StylesheetOutcome): void => { outcomes.push(outcome); }
                });
                const layout = visualizer.layout;
                const helper = layout.constructor as typeof import("@src/layout").LayoutHelper;
                helper.TIMEOUT = 100;
                const container = document.createElement("div");
                const iframe = document.createElement("iframe");
                document.body.appendChild(container);
                container.appendChild(iframe);
                layout.nodes[1] = iframe.contentDocument.head;
                layout.nodes[3] = container;
                layout.nodes[4] = iframe;
                const pending = { settled: false };
                const rendering = layout.dom({ event: 6, time: 0, data: [{
                    id: 2, parent: 1, previous: null, tag: "LINK",
                    attributes: { rel: "stylesheet", href: "https://provider.invalid/pending.css" }
                }] });
                void rendering.then((): void => { pending.settled = true; });
                layout.markup({ event: 6, time: 1, data: [{
                    id: removed === "iframe" ? 4 : 3, parent: null, previous: null,
                    tag: removed === "iframe" ? "IFRAME" : "DIV"
                }] });
                return { iframe, pending, outcomes };
            }, { removed: scenario.removal, loading: scenario.mode });

            await expect.poll(() => state.evaluate(({ pending }) => pending.settled), { timeout: 2000 }).toBe(true);
            expect(await state.evaluate(({ iframe }) => ({
                connected: iframe.isConnected,
                visibility: document.documentElement.style.visibility
            }))).toEqual({ connected: false, visibility: "visible" });
            expect(await state.evaluate(({ outcomes }) => outcomes)).toEqual(scenario.mode === "ordinary" ? [] : [{
                status: "failed", fallback: true, transformation: undefined
            }]);
            await state.dispose();
        });
    }

    test("reset settles pending stylesheet loading after the replay iframe is removed", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const api = (window as Window & { clarity: { visualize: typeof import("@src/clarity") } }).clarity.visualize;
            const iframe = document.createElement("iframe");
            document.body.appendChild(iframe);
            const visualizer = await api.setup(iframe.contentWindow, { version: "0.8.72" });
            const layout = visualizer.layout;
            layout.nodes[1] = iframe.contentDocument.head;
            layout.markup({ event: 6, time: 0, data: [{
                id: 2, parent: 1, previous: null, tag: "LINK",
                attributes: { rel: "stylesheet", href: "data:text/css,.target%7Bcolor:red%7D" }
            }] });
            const link = layout.element(2) as HTMLLinkElement;
            const pending = layout.stylesheets[0];
            iframe.remove();
            layout.reset();
            await pending;
            return {
                onload: link.onload,
                onerror: link.onerror,
                stylesheets: layout.stylesheets.length,
                node: layout.element(2)
            };
        });

        expect(result).toEqual({ onload: null, onerror: null, stylesheets: 0, node: null });
    });

    test("transforms a loaded stylesheet and applies replay hover styling", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const api = (window as Window & { clarity: { visualize: typeof import("@src/clarity") } }).clarity.visualize;
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
                const api = (window as Window & { clarity: { visualize: typeof import("@src/clarity") } }).clarity.visualize;
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
                const api = (window as Window & { clarity: { visualize: typeof import("@src/clarity") } }).clarity.visualize;
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

    for (const change of ["href", "rel", "reset", "fallback"]) {
        test(`a stale load cannot overwrite a ${change} mutation`, async ({ page }) => {
            const result = await page.evaluate(async (mutation: string) => {
                const api = (window as Window & { clarity: { visualize: typeof import("@src/clarity") } }).clarity.visualize;
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
                layout.reset();
                return { unchanged, href, outcomes };
            }, change);

            expect(result.unchanged).toBe(true);
            expect(result.outcomes).toEqual([]);
            if (change !== "reset") { expect(result.href).toContain(".new:hover"); }
        });
    }

    for (const access of ["sheet", "cssRules"]) {
        test(`reports a loaded stylesheet without logging ${access} access errors`, async ({ page }) => {
            const result = await page.evaluate(async (property: string) => {
                const api = (window as Window & { clarity: { visualize: typeof import("@src/clarity") } }).clarity.visualize;
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
