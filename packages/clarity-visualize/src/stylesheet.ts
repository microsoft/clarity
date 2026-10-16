import type { StylesheetOutcomeStatus } from "../types/visualize";

export type StylesheetReplace = (current: HTMLLinkElement, replacement: HTMLLinkElement) => void;

export interface StylesheetLoadResult {
    status: StylesheetOutcomeStatus;
    fallback: boolean;
    link: HTMLLinkElement;
}

export interface StylesheetLoad {
    ready: Promise<StylesheetLoadResult>;
    cancel(): void;
}

export function loadStylesheet(
    initial: HTMLLinkElement,
    url: string,
    timeout: number,
    replace: StylesheetReplace,
    cors: boolean = false
): StylesheetLoad {
    let cancel: () => void;
    const ready = new Promise((resolve: (outcome: StylesheetLoadResult) => void): void => {
        let link = initial;
        let attempt = 0;
        let timer: number = null;
        let complete = false;
        let fallback = false;

        const finish = (status: StylesheetOutcomeStatus): void => {
            if (complete) { return; }
            complete = true;
            clear();
            link.onload = null;
            link.onerror = null;
            resolve({ status, fallback, link });
        };

        cancel = (): void => finish("cancelled");

        const clear = (): void => {
            if (timer !== null) {
                link.ownerDocument.defaultView.clearTimeout(timer);
                timer = null;
            }
        };

        const start = (): void => {
            const current = ++attempt;
            link.onload = (): void => {
                if (complete || current !== attempt) { return; }
                finish("loaded");
            };
            link.onerror = (): void => {
                if (complete || current !== attempt) { return; }
                cors && !fallback ? retry(current) : finish("failed");
            };
            timer = link.ownerDocument.defaultView.setTimeout(
                (): void => cors && !fallback ? retry(current) : finish("failed"),
                timeout
            );
            link.href = url;
        };

        const retry = (current: number): void => {
            if (complete || current !== attempt) { return; }
            clear();
            const failed = link;
            failed.onload = null;
            failed.onerror = null;
            // Retry the same URL on a fresh link without CORS, preserving styling without hover transformation.
            link = failed.cloneNode(true) as HTMLLinkElement;
            link.removeAttribute("crossorigin");
            link.removeAttribute("integrity");
            link.removeAttribute("href");
            link.onload = null;
            link.onerror = null;
            fallback = true;
            start();
            replace(failed, link);
        };

        if (cors) { link.crossOrigin = "anonymous"; }
        start();
    });
    return { ready, cancel };
}
