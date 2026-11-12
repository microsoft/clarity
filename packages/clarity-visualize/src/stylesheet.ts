import type { StylesheetOutcomeStatus } from "@clarity-types/visualize";

export type StylesheetReplace = (current: HTMLLinkElement, replacement: HTMLLinkElement) => void;

export interface StylesheetLoadResult {
    status: StylesheetOutcomeStatus;
    fallback: boolean;
    link: HTMLLinkElement;
}

export interface StylesheetLoad {
    ready: Promise<void>;
    completed: Promise<StylesheetLoadResult>;
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
    let release: () => void;
    const ready = new Promise<void>((resolve: () => void): void => { release = resolve; });
    const completed = new Promise((resolve: (outcome: StylesheetLoadResult) => void): void => {
        let link = initial;
        let attempt = 0;
        let timer: ReturnType<typeof setTimeout> = null;
        let complete = false;
        let fallback = false;

        const finish = (status: StylesheetOutcomeStatus): void => {
            if (complete) { return; }
            complete = true;
            clear();
            link.onload = null;
            link.onerror = null;
            resolve({ status, fallback, link });
            release();
        };

        cancel = (): void => finish("cancelled");

        const clear = (): void => {
            if (timer !== null) {
                clearTimeout(timer);
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
            // Recorded iframe windows can be destroyed while their stylesheets are still loading.
            timer = setTimeout(
                (): void => {
                    if (complete || current !== attempt) { return; }
                    if (cors) {
                        fallback ? finish("failed") : retry(current);
                    } else {
                        // Reveal replay without discarding a stylesheet that is still downloading.
                        clear();
                        release();
                    }
                },
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
    return { ready, completed, cancel };
}
