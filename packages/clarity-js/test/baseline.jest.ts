import { BooleanFlag, Event } from "@clarity-types/data";

// Mock modules with browser dependencies
jest.mock("@src/data/encode", () => ({ default: jest.fn() }));
jest.mock("@src/core/time", () => ({ time: jest.fn(() => 0) }));

import * as baseline from "@src/data/baseline";

function getBufferSnapshot() {
    baseline.reset();
    return baseline.state?.data;
}

describe("Baseline", () => {
    beforeEach(() => {
        // Jest caches modules but doesn't reset module-level state.
        // For tests that depend on clean state, we accept that stop()+start()
        // resets the update flag but preserves the buffer (by design in baseline.ts).
        // Tests should not assume zero-state for fields modified by prior tests.
        baseline.stop();
        baseline.start();
    });

    afterEach(() => {
        baseline.stop();
    });

    // --- track() event routing ---

    test("scroll event updates scrollX, scrollY, and scrollTime", () => {
        baseline.track(Event.Scroll, 120, 450, 5000);
        const data = getBufferSnapshot();
        expect(data.scrollX).toBe(120);
        expect(data.scrollY).toBe(450);
        expect(data.scrollTime).toBe(5000);
    });

    test("document event updates docWidth and docHeight", () => {
        baseline.track(Event.Document, 1920, 3000);
        const data = getBufferSnapshot();
        expect(data.docWidth).toBe(1920);
        expect(data.docHeight).toBe(3000);
    });

    test("resize event updates screenWidth and screenHeight", () => {
        baseline.track(Event.Resize, 1440, 900);
        const data = getBufferSnapshot();
        expect(data.screenWidth).toBe(1440);
        expect(data.screenHeight).toBe(900);
    });

    test("mousemove event updates moveX, moveY, moveTime and pointer", () => {
        baseline.track(Event.MouseMove, 200, 300, 1000);
        const data = getBufferSnapshot();
        expect(data.moveX).toBe(200);
        expect(data.moveY).toBe(300);
        expect(data.moveTime).toBe(1000);
        expect(data.pointerX).toBe(200);
        expect(data.pointerY).toBe(300);
        expect(data.pointerTime).toBe(1000);
    });

    test("mousedown event updates downX, downY, downTime and pointer", () => {
        baseline.track(Event.MouseDown, 50, 75, 2000);
        const data = getBufferSnapshot();
        expect(data.downX).toBe(50);
        expect(data.downY).toBe(75);
        expect(data.downTime).toBe(2000);
        expect(data.pointerX).toBe(50);
        expect(data.pointerY).toBe(75);
    });

    test("mouseup event updates upX, upY, upTime and pointer", () => {
        baseline.track(Event.MouseUp, 60, 80, 3000);
        const data = getBufferSnapshot();
        expect(data.upX).toBe(60);
        expect(data.upY).toBe(80);
        expect(data.upTime).toBe(3000);
        expect(data.pointerX).toBe(60);
        expect(data.pointerY).toBe(80);
    });

    test("default event case only updates pointer fields", () => {
        baseline.track(Event.Click, 100, 200, 4000);
        const data = getBufferSnapshot();
        expect(data.pointerX).toBe(100);
        expect(data.pointerY).toBe(200);
        expect(data.pointerTime).toBe(4000);
    });

    // --- Pointer previous tracking ---

    test("successive pointer events save previous pointer values", () => {
        baseline.track(Event.MouseMove, 10, 20, 100);
        baseline.track(Event.MouseMove, 30, 40, 200);
        const data = getBufferSnapshot();
        expect(data.pointerX).toBe(30);
        expect(data.pointerY).toBe(40);
        expect(data.pointerTime).toBe(200);
        expect(data.pointerPrevX).toBe(10);
        expect(data.pointerPrevY).toBe(20);
        expect(data.pointerPrevTime).toBe(100);
    });

    // --- activity() ---

    test("activity updates activityTime", () => {
        baseline.activity(9999);
        baseline.track(Event.Scroll, 0, 0, 0);
        const data = getBufferSnapshot();
        expect(data.activityTime).toBe(9999);
    });

    // --- visibility() ---

    test("visibility updates visible flag", () => {
        baseline.visibility(5000, BooleanFlag.False);
        const data = getBufferSnapshot();
        expect(data.visible).toBe(BooleanFlag.False);
    });

    test("visibility with hidden state also sets activityTime", () => {
        baseline.visibility(7000, BooleanFlag.False);
        const data = getBufferSnapshot();
        expect(data.activityTime).toBe(7000);
    });

    test("visibility with visible state does not change activityTime", () => {
        baseline.visibility(8000, BooleanFlag.True);
        const data = getBufferSnapshot();
        // activityTime should not be updated by a "visible" event —
        // it retains whatever value it had before (not set to 8000)
        expect(data.activityTime).not.toBe(8000);
    });

    // --- dynamic() ---

    test("dynamic stores module set as array", () => {
        baseline.dynamic(new Set([1, 5, 10]));
        const data = getBufferSnapshot();
        expect(data.modules).toEqual([1, 5, 10]);
    });

    // --- Lifecycle ---

    test("multiple scroll track calls overwrite — last one wins", () => {
        baseline.track(Event.Scroll, 100, 200, 1000);
        baseline.track(Event.Scroll, 300, 400, 2000);
        const data = getBufferSnapshot();
        expect(data.scrollX).toBe(300);
        expect(data.scrollY).toBe(400);
        expect(data.scrollTime).toBe(2000);
    });

    test("different event types accumulate independently", () => {
        baseline.track(Event.Scroll, 10, 20, 100);
        baseline.track(Event.Document, 1920, 3000);
        baseline.track(Event.Resize, 1440, 900);
        baseline.track(Event.MouseMove, 50, 60, 200);
        const data = getBufferSnapshot();
        expect(data.scrollX).toBe(10);
        expect(data.scrollY).toBe(20);
        expect(data.docWidth).toBe(1920);
        expect(data.docHeight).toBe(3000);
        expect(data.screenWidth).toBe(1440);
        expect(data.screenHeight).toBe(900);
        expect(data.moveX).toBe(50);
        expect(data.moveY).toBe(60);
    });
});
