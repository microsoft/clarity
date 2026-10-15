import type { HoverTransformationSummary } from "./hover";

export type StylesheetTransform = (link: HTMLLinkElement) => HoverTransformationSummary;
export type StylesheetReplace = (current: HTMLLinkElement, replacement: HTMLLinkElement) => void;

export type StylesheetOutcomeStatus = "readable" | "unreadable" | "opaque-fallback" | "failed";

export interface StylesheetOutcome {
    status: StylesheetOutcomeStatus;
    transformation?: HoverTransformationSummary;
}

export function loadCorsStylesheet(
    initial: HTMLLinkElement,
    url: string,
    timeout: number,
    transform: StylesheetTransform,
    replace: StylesheetReplace
): Promise<StylesheetOutcome> {
    return new Promise((resolve: (outcome: StylesheetOutcome) => void): void => {
        let link = initial;
        let attempt = 0;
        let timer: number = null;
        let complete = false;

        const finish = (outcome: StylesheetOutcome): void => {
            if (complete) { return; }
            complete = true;
            clear();
            link.onload = null;
            link.onerror = null;
            resolve(outcome);
        };

        const clear = (): void => {
            if (timer !== null) {
                link.ownerDocument.defaultView.clearTimeout(timer);
                timer = null;
            }
        };

        const start = (fallback: boolean): void => {
            const current = ++attempt;
            link.onload = (): void => {
                if (complete || current !== attempt) { return; }
                clear();
                if (!fallback) {
                    try {
                        finish({ status: "readable", transformation: transform(link) });
                    } catch (error) {
                        // An unexpectedly opaque sheet is already applied; preserve it without retrying.
                        finish({ status: "unreadable" });
                    }
                } else {
                    finish({ status: "opaque-fallback" });
                }
            };
            link.onerror = (): void => {
                if (complete || current !== attempt) { return; }
                fallback ? finish({ status: "failed" }) : retry(current);
            };
            timer = link.ownerDocument.defaultView.setTimeout(
                (): void => fallback ? finish({ status: "failed" }) : retry(current),
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
            link = failed.cloneNode(true) as HTMLLinkElement;
            link.removeAttribute("crossorigin");
            link.removeAttribute("integrity");
            link.removeAttribute("href");
            link.onload = null;
            link.onerror = null;
            start(true);
            replace(failed, link);
        };

        link.crossOrigin = "anonymous";
        start(false);
    });
}
