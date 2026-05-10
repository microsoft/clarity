import { BooleanFlag, Event } from "@clarity-types/data";

// Mock modules with browser dependencies
jest.mock("@src/data/encode", () => ({ default: jest.fn() }));
jest.mock("@src/core/time", () => ({ time: jest.fn(() => 0) }));

import * as baseline from "@src/data/baseline";

/** Default buffer values after a fresh start — used for initial state verification. */
const DEFAULTS = {
    visible: BooleanFlag.True,
    docWidth: 0,
    docHeight: 0,
    screenWidth: 0,
    screenHeight: 0,
    scrollX: 0,
    scrollY: 0,
    pointerX: 0,
    pointerY: 0,
    activityTime: 0,
    scrollTime: 0,
    pointerTime: undefined,
    moveX: undefined,
    moveY: undefined,
    moveTime: undefined,
    downX: undefined,
    downY: undefined,
    downTime: undefined,
    upX: undefined,
    upY: undefined,
    upTime: undefined,
    pointerPrevX: undefined,
    pointerPrevY: undefined,
    pointerPrevTime: undefined,
    modules: null,
};

/**
 * Snapshots the current buffer into state and returns it.
 * Requires at least one track() call first (so update=true).
 */
function getBufferSnapshot() {
    baseline.reset();
    return baseline.state?.data;
}

/**
 * Asserts that the given fields have the expected values, AND that a set of
 * "unrelated" fields were NOT changed by the operation under test.
 *
 * `changed` — fields expected to have specific values after the operation.
 * `unchanged` — fields expected to remain at their default. These catch
 * unintended side effects (e.g., a scroll event accidentally writing to docWidth).
 */
function expectChanged(changed: Record<string, unknown>, unchanged: string[]) {
    const data = getBufferSnapshot();
    for (const [key, value] of Object.entries(changed)) {
        expect(data[key]).toEqual(value);
    }
    for (const key of unchanged) {
        expect(data[key]).toEqual(DEFAULTS[key]);
    }
}

describe("Baseline", () => {
    // NOTE: baseline.ts uses a module-level singleton buffer that persists across
    // stop()/start() cycles (by design). Tests within this suite share that buffer.
    // The FIRST describe block runs against a fresh buffer. Later tests may see
    // values set by earlier tests — assertions are written to account for this.

    beforeEach(() => {
        baseline.stop();
        baseline.start();
    });

    afterEach(() => {
        baseline.stop();
    });

    // --- Initial state ---
    // These tests run first and verify the fresh buffer state.

    test("state is null before any tracking", () => {
        expect(baseline.state).toBeNull();
    });

    test("initial buffer has all expected defaults", () => {
        // Need one track call so reset() can snapshot buffer into state
        baseline.track(Event.Scroll, 0, 0, 0);
        const data = getBufferSnapshot();
        for (const [key, value] of Object.entries(DEFAULTS)) {
            expect(data[key]).toEqual(value);
        }
    });

    // --- track() event routing ---
    // Each test verifies the expected fields AND checks that unrelated fields
    // were not modified by the event.

    test("scroll event updates scrollX, scrollY, scrollTime — not doc/screen/pointer", () => {
        baseline.track(Event.Scroll, 120, 450, 5000);
        expectChanged(
            { scrollX: 120, scrollY: 450, scrollTime: 5000 },
            ["docWidth", "docHeight", "screenWidth", "screenHeight",
             "moveX", "moveY", "moveTime", "downX", "downY", "downTime",
             "upX", "upY", "upTime", "pointerPrevX", "pointerPrevY", "pointerPrevTime"],
        );
    });

    test("document event updates docWidth, docHeight — not scroll/screen/pointer", () => {
        baseline.track(Event.Document, 1920, 3000);
        expectChanged(
            { docWidth: 1920, docHeight: 3000 },
            ["screenWidth", "screenHeight",
             "moveX", "moveY", "moveTime", "downX", "downY", "downTime",
             "upX", "upY", "upTime", "pointerPrevX", "pointerPrevY", "pointerPrevTime"],
        );
    });

    test("resize event updates screenWidth, screenHeight — not doc/scroll/pointer", () => {
        baseline.track(Event.Resize, 1440, 900);
        expectChanged(
            { screenWidth: 1440, screenHeight: 900 },
            ["moveX", "moveY", "moveTime", "downX", "downY", "downTime",
             "upX", "upY", "upTime", "pointerPrevX", "pointerPrevY", "pointerPrevTime"],
        );
    });

    test("mousemove updates move+pointer fields — not down/up", () => {
        baseline.track(Event.MouseMove, 200, 300, 1000);
        expectChanged(
            { moveX: 200, moveY: 300, moveTime: 1000,
              pointerX: 200, pointerY: 300, pointerTime: 1000 },
            ["downX", "downY", "downTime", "upX", "upY", "upTime"],
        );
    });

    test("mousedown updates down+pointer fields — not move/up", () => {
        baseline.track(Event.MouseDown, 50, 75, 2000);
        expectChanged(
            { downX: 50, downY: 75, downTime: 2000, pointerX: 50, pointerY: 75 },
            ["upX", "upY", "upTime"],
        );
    });

    test("mouseup updates up+pointer fields — not down/move", () => {
        baseline.track(Event.MouseUp, 60, 80, 3000);
        expectChanged(
            { upX: 60, upY: 80, upTime: 3000, pointerX: 60, pointerY: 80 },
            [],
        );
    });

    test("default event (Click) only updates pointer fields — not move/down/up", () => {
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

    test("visibility(False) sets visible flag and activityTime", () => {
        baseline.visibility(5000, BooleanFlag.False);
        const data = getBufferSnapshot();
        expect(data.visible).toBe(BooleanFlag.False);
        expect(data.activityTime).toBe(5000);
    });

    test("visibility(True) does not set activityTime", () => {
        baseline.visibility(8000, BooleanFlag.True);
        const data = getBufferSnapshot();
        expect(data.visible).toBe(BooleanFlag.True);
        // activityTime should NOT be set to 8000 — visible events don't update it
        expect(data.activityTime).not.toBe(8000);
    });

    // --- dynamic() ---

    test("dynamic stores module set as array", () => {
        baseline.dynamic(new Set([1, 5, 10]));
        baseline.track(Event.Scroll, 0, 0, 0);
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
        expect(data.scrollTime).toBe(100);
        expect(data.docWidth).toBe(1920);
        expect(data.docHeight).toBe(3000);
        expect(data.screenWidth).toBe(1440);
        expect(data.screenHeight).toBe(900);
        expect(data.moveX).toBe(50);
        expect(data.moveY).toBe(60);
        expect(data.moveTime).toBe(200);
        expect(data.pointerX).toBe(50);
        expect(data.pointerY).toBe(60);
        expect(data.pointerTime).toBe(200);
    });

    // --- Encoding ---

    test("track sets update flag so reset triggers encode", () => {
        const encode = require("@src/data/encode").default;
        encode.mockClear();

        baseline.track(Event.Scroll, 10, 20, 100);
        baseline.reset(); // should snapshot to state (update=true)
        expect(baseline.state).not.toBeNull();
        expect(baseline.state.event).toBe(Event.Baseline);
        expect(baseline.state.data.scrollX).toBe(10);
    });

    test("reset without prior track does not update state", () => {
        // After start(), update=false — reset should not snapshot
        const stateBefore = baseline.state;
        baseline.reset();
        expect(baseline.state).toBe(stateBefore);
    });
});
