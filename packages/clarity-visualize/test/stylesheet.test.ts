import { expect, test } from "@playwright/test";
import { HoverTransformationSummary } from "../src/hover";
import { loadCorsStylesheet } from "../src/stylesheet";

test.describe("CORS proxy stylesheet loading", () => {
    test("transforms a readable CORS stylesheet and resolves once", async () => {
        const link = createLink();
        let transformed = 0;

        const ready = loadCorsStylesheet(link, "data:text/css,.target%7Bcolor:red%7D", 1000, () => {
            transformed++;
            return summary();
        }, (): void => undefined);

        fire(link.onload);
        const outcome = await ready;
        expect(transformed).toBe(1);
        expect(outcome).toEqual({ status: "readable", transformation: summary() });
    });

    test("retries the exact provider URL once without CORS or integrity", async () => {
        const link = createLink({ integrity: "recorded" });
        const providerUrl = "https://provider.invalid/cached.css";
        let fallback: HTMLLinkElement = null;
        let replacements = 0;

        const ready = loadCorsStylesheet(link, providerUrl, 1000, summary,
            (failed: HTMLLinkElement, replacement: HTMLLinkElement): void => {
                replacements++;
                fallback = replacement;
            });
        fire(link.onerror);

        expect(fallback).not.toBeNull();
        expect(fallback.href).toBe(providerUrl);
        expect(fallback.hasAttribute("crossorigin")).toBe(false);
        expect(fallback.hasAttribute("integrity")).toBe(false);
        fire(fallback.onload);
        expect(await ready).toEqual({ status: "opaque-fallback" });
        expect(replacements).toBe(1);
    });

    test("preserves a loaded stylesheet when CSSOM is unexpectedly unreadable", async () => {
        const link = createLink();
        let replacements = 0;

        const ready = loadCorsStylesheet(link, "https://provider.invalid/cached.css", 1000, () => {
            throw new Error("SecurityError");
        }, (): void => {
            replacements++;
        });
        fire(link.onload);
        expect(await ready).toEqual({ status: "unreadable" });

        expect(replacements).toBe(0);
        expect(link.href).toBe("https://provider.invalid/cached.css");
    });

    test("ignores stale callbacks and resolves after terminal fallback failure", async () => {
        const link = createLink();
        let fallback: HTMLLinkElement = null;
        let transformed = 0;

        const ready = loadCorsStylesheet(link, "https://provider.invalid/cached.css", 1000, () => {
            transformed++;
            return summary();
        }, (failed: HTMLLinkElement, replacement: HTMLLinkElement): void => {
            fallback = replacement;
        });
        const firstLoad = link.onload;
        fire(link.onerror);
        fire(firstLoad);
        fire(fallback.onerror);
        expect(await ready).toEqual({ status: "failed" });

        expect(transformed).toBe(0);
    });

    test("gives both attempts independent timeouts", async () => {
        const link = createLink();
        let fallback: HTMLLinkElement = null;

        const ready = loadCorsStylesheet(link, "https://provider.invalid/cached.css", 5, summary,
            (failed: HTMLLinkElement, replacement: HTMLLinkElement): void => {
                fallback = replacement;
            });

        await new Promise((resolve: () => void): number => setTimeout(resolve, 7));
        expect(fallback).not.toBeNull();
        expect(await ready).toEqual({ status: "failed" });
    });
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
        ownerDocument: {
            defaultView: {
                setTimeout,
                clearTimeout
            }
        },
        cloneNode(): MockLink {
            const clone = createLink(attributes) as never as MockLink;
            clone.href = link.href;
            clone.crossOrigin = link.crossOrigin;
            if (clone.href) { attributes["href"] = clone.href; }
            if (clone.crossOrigin) { attributes["crossorigin"] = clone.crossOrigin; }
            return clone;
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

function summary(): HoverTransformationSummary {
    return {
        scanned: 1,
        hover: 1,
        transformed: 1,
        partial: 0,
        unsupported: 0,
        parseFailed: 0,
        insertionFailed: 0
    };
}
