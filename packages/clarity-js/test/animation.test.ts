import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Animation capture tests - loads the built clarity.min.js in a browser and verifies
 * that Clarity's Web Animations instrumentation skips pseudo-element animations.
 *
 * Regression test for issue #1112: calling getKeyframes()/getTiming() on a
 * pseudo-element-targeted effect (e.g. ::view-transition-*) crashes Firefox's content
 * process during View Transitions. Clarity must not read keyframes/timing for any
 * animation whose effect targets a pseudo-element.
 */

// Use the minified browser build which exposes window.clarity.
const clarityJsPath = join(__dirname, "../build/clarity.min.js");

interface CaptureResult {
    // pseudoElement values seen by getKeyframes()/getTiming() while Clarity is running.
    getKeyframesPseudos: string[];
    getTimingPseudos: string[];
    // Whether the browser actually applied the pseudoElement to the effect (sanity check).
    pseudoElementSet: string | null;
    // Confirms a normal (non-pseudo) animation is still captured.
    normalCaptured: boolean;
}

test.describe("animation - pseudo-element capture", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("data:text/html,<!DOCTYPE html><html><head></head><body><div id='box'>hi</div></body></html>");
        const clarityJs = readFileSync(clarityJsPath, "utf-8");
        await page.evaluate((code) => { eval(code); }, clarityJs);
    });

    test("skips pseudo-element animations but still captures normal animations", async ({ page }) => {
        const result: CaptureResult = await page.evaluate(() => {
            return new Promise<CaptureResult>((resolve) => {
                (window as any).clarity("start", { projectId: "test", track: false, upload: false });

                // Let Clarity discover the DOM, then spy on the crash-triggering calls and
                // exercise both a pseudo-element animation and a normal animation.
                setTimeout(() => {
                    const getKeyframesPseudos: string[] = [];
                    const getTimingPseudos: string[] = [];
                    const KE: any = (window as any).KeyframeEffect;
                    const origGetKeyframes = KE.prototype.getKeyframes;
                    const origGetTiming = KE.prototype.getTiming;
                    KE.prototype.getKeyframes = function (): Keyframe[] {
                        getKeyframesPseudos.push(this.pseudoElement || "(none)");
                        return origGetKeyframes.apply(this, arguments);
                    };
                    KE.prototype.getTiming = function (): EffectTiming {
                        getTimingPseudos.push(this.pseudoElement || "(none)");
                        return origGetTiming.apply(this, arguments);
                    };

                    const frames: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
                    const timing = { duration: 200 };

                    // Pseudo-element animation (::before) - stands in for ::view-transition-*.
                    const effect = new KE(document.body, frames, { ...timing, pseudoElement: "::before" });
                    const pseudoElementSet: string | null = effect.pseudoElement;
                    const pseudoAnim = new Animation(effect, document.timeline);
                    pseudoAnim.play();
                    pseudoAnim.finish();

                    // Normal element animation - must still be captured.
                    const normalAnim = (document.getElementById("box") as HTMLElement).animate(frames, timing);
                    normalAnim.finish();

                    setTimeout(() => {
                        resolve({
                            getKeyframesPseudos,
                            getTimingPseudos,
                            pseudoElementSet,
                            normalCaptured: getKeyframesPseudos.indexOf("(none)") !== -1,
                        });
                    }, 100);
                }, 300);
            });
        });

        // Sanity check: the browser supports animating a pseudo-element via WAAPI.
        test.skip(result.pseudoElementSet !== "::before", "KeyframeEffect pseudoElement option not supported in this browser");
        expect(result.pseudoElementSet).toBe("::before");
        // Clarity must never read keyframes/timing for a pseudo-element effect.
        const pseudoKeyframeCalls = result.getKeyframesPseudos.filter((p) => p !== "(none)");
        const pseudoTimingCalls = result.getTimingPseudos.filter((p) => p !== "(none)");
        expect(pseudoKeyframeCalls).toEqual([]);
        expect(pseudoTimingCalls).toEqual([]);

        // Normal (non-pseudo) animations are still captured.
        expect(result.normalCaptured).toBe(true);
    });
});
