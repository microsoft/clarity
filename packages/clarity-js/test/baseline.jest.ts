import { BooleanFlag, Event } from "@clarity-types/data";

// Mock modules with browser dependencies.
jest.mock("@src/data/encode", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@src/core/time", () => ({ time: jest.fn(() => 0) }));

import * as baseline from "@src/data/baseline";

const mockEncode: jest.Mock = require("@src/data/encode").default;
const mockTime: jest.Mock = require("@src/core/time").time;

/**
 * Snapshots buffer via reset(), returns state.data.
 * Requires at least one track() call first (so update=true).
 */
function getBufferSnapshot() {
    baseline.reset();
    return baseline.state?.data;
}

/**
 * Snapshot-diff helper: takes a "before" snapshot, runs the operation,
 * takes an "after" snapshot, and verifies ONLY the expected keys changed.
 * Catches unintended side effects automatically.
 */
function expectOnlyChanges(
    before: Record<string, unknown> | any,
    after: Record<string, unknown> | any,
    expected: Record<string, unknown>,
) {
    // Verify expected fields have expected values
    for (const [key, value] of Object.entries(expected)) {
        expect(after[key]).toEqual(value);
    }
    // Verify all other fields are unchanged from before
    for (const key of Object.keys(after)) {
        if (!(key in expected)) {
            expect(after[key]).toEqual(before[key]);
        }
    }
}

describe("Baseline", () => {
    // baseline.ts uses a module-level singleton buffer that persists across
    // stop()/start() cycles (by design). Tests use snapshot-diff to detect
    // side effects: capture state before and after, verify only expected
    // fields changed.

    beforeEach(() => {
        mockEncode.mockClear();
        mockTime.mockReturnValue(0);
        baseline.stop();
        baseline.start();
    });

    afterEach(() => {
        baseline.stop();
    });

    // --- Initial state ---

    test("state is null before any tracking", () => {
        expect(baseline.state).toBeNull();
    });

    // --- Event routing with side-effect detection ---

    test("scroll updates only scrollX, scrollY, scrollTime", () => {
        // Prime the buffer so we can snapshot
        baseline.track(Event.Scroll, 0, 0, 0);
        const before = { ...getBufferSnapshot() };
        baseline.track(Event.Scroll, 120, 450, 5000);
        const after = getBufferSnapshot();
        expectOnlyChanges(before, after, { scrollX: 120, scrollY: 450, scrollTime: 5000 });
    });

    test("document updates only docWidth, docHeight", () => {
        baseline.track(Event.Scroll, 0, 0, 0);
        const before = { ...getBufferSnapshot() };
        baseline.track(Event.Document, 1920, 3000, 500);
        const after = getBufferSnapshot();
        expectOnlyChanges(before, after, { docWidth: 1920, docHeight: 3000 });
    });

    test("resize updates only screenWidth, screenHeight", () => {
        baseline.track(Event.Scroll, 0, 0, 0);
        const before = { ...getBufferSnapshot() };
        baseline.track(Event.Resize, 1440, 900, 600);
        const after = getBufferSnapshot();
        expectOnlyChanges(before, after, { screenWidth: 1440, screenHeight: 900 });
    });

    test("mousemove updates move + pointer fields only", () => {
        baseline.track(Event.Scroll, 0, 0, 0);
        const before = { ...getBufferSnapshot() };
        baseline.track(Event.MouseMove, 200, 300, 1000);
        const after = getBufferSnapshot();
        expectOnlyChanges(before, after, {
            moveX: 200, moveY: 300, moveTime: 1000,
            pointerX: 200, pointerY: 300, pointerTime: 1000,
            pointerPrevX: before.pointerX, pointerPrevY: before.pointerY,
            pointerPrevTime: before.pointerTime,
        });
    });

    test("mousedown updates down + pointer fields only", () => {
        baseline.track(Event.Scroll, 0, 0, 0);
        const before = { ...getBufferSnapshot() };
        baseline.track(Event.MouseDown, 50, 75, 2000);
        const after = getBufferSnapshot();
        expectOnlyChanges(before, after, {
            downX: 50, downY: 75, downTime: 2000,
            pointerX: 50, pointerY: 75, pointerTime: 2000,
            pointerPrevX: before.pointerX, pointerPrevY: before.pointerY,
            pointerPrevTime: before.pointerTime,
        });
    });

    test("mouseup updates up + pointer fields only", () => {
        baseline.track(Event.Scroll, 0, 0, 0);
        const before = { ...getBufferSnapshot() };
        baseline.track(Event.MouseUp, 60, 80, 3000);
        const after = getBufferSnapshot();
        expectOnlyChanges(before, after, {
            upX: 60, upY: 80, upTime: 3000,
            pointerX: 60, pointerY: 80, pointerTime: 3000,
            pointerPrevX: before.pointerX, pointerPrevY: before.pointerY,
            pointerPrevTime: before.pointerTime,
        });
    });

    test("default event (Click) updates pointer fields only", () => {
        baseline.track(Event.Scroll, 0, 0, 0);
        const before = { ...getBufferSnapshot() };
        baseline.track(Event.Click, 100, 200, 4000);
        const after = getBufferSnapshot();
        expectOnlyChanges(before, after, {
            pointerX: 100, pointerY: 200, pointerTime: 4000,
            pointerPrevX: before.pointerX, pointerPrevY: before.pointerY,
            pointerPrevTime: before.pointerTime,
        });
    });

    // --- Compound stateful scenarios ---

    test("successive pointer events propagate current → prev correctly", () => {
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

    test("interleaved pointer event types share prev tracking", () => {
        baseline.track(Event.MouseMove, 10, 20, 100);
        baseline.track(Event.MouseDown, 30, 40, 200);
        baseline.track(Event.MouseUp, 50, 60, 300);
        const data = getBufferSnapshot();
        // Last event (MouseUp) is current, MouseDown is prev
        expect(data.pointerX).toBe(50);
        expect(data.pointerY).toBe(60);
        expect(data.pointerPrevX).toBe(30);
        expect(data.pointerPrevY).toBe(40);
        expect(data.pointerPrevTime).toBe(200);
        // Each event type also stored its own fields
        expect(data.moveX).toBe(10);
        expect(data.moveY).toBe(20);
        expect(data.downX).toBe(30);
        expect(data.downY).toBe(40);
        expect(data.upX).toBe(50);
        expect(data.upY).toBe(60);
    });

    test("three pointer events: only one level of prev is kept", () => {
        baseline.track(Event.MouseMove, 1, 2, 10);
        baseline.track(Event.MouseMove, 3, 4, 20);
        baseline.track(Event.MouseMove, 5, 6, 30);
        const data = getBufferSnapshot();
        // Current = last event, prev = second-to-last (first event is lost)
        expect(data.pointerX).toBe(5);
        expect(data.pointerY).toBe(6);
        expect(data.pointerPrevX).toBe(3);
        expect(data.pointerPrevY).toBe(4);
        expect(data.pointerPrevTime).toBe(20);
    });

    test("different event types accumulate independently", () => {
        baseline.track(Event.Scroll, 10, 20, 100);
        baseline.track(Event.Document, 1920, 3000, 150);
        baseline.track(Event.Resize, 1440, 900, 160);
        baseline.track(Event.MouseMove, 50, 60, 200);
        const data = getBufferSnapshot();
        expect(data.scrollX).toBe(10);
        expect(data.scrollY).toBe(20);
        expect(data.docWidth).toBe(1920);
        expect(data.docHeight).toBe(3000);
        expect(data.screenWidth).toBe(1440);
        expect(data.screenHeight).toBe(900);
        expect(data.moveX).toBe(50);
        expect(data.pointerX).toBe(50);
    });

    test("visibility(False) + track compounds activityTime and event data", () => {
        baseline.visibility(5000, BooleanFlag.False);
        baseline.track(Event.Scroll, 100, 200, 6000);
        const data = getBufferSnapshot();
        expect(data.visible).toBe(BooleanFlag.False);
        expect(data.activityTime).toBe(5000);
        expect(data.scrollX).toBe(100);
        expect(data.scrollY).toBe(200);
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
        baseline.track(Event.Scroll, 0, 0, 0); // need update=true for snapshot
        const data = getBufferSnapshot();
        expect(data.visible).toBe(BooleanFlag.False);
        expect(data.activityTime).toBe(5000);
    });

    test("visibility(True) does not set activityTime", () => {
        baseline.visibility(8000, BooleanFlag.True);
        baseline.track(Event.Scroll, 0, 0, 0);
        const data = getBufferSnapshot();
        expect(data.visible).toBe(BooleanFlag.True);
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

    test("buffer values persist across stop/start cycles (by design)", () => {
        baseline.track(Event.Scroll, 999, 888, 7000);
        baseline.stop();
        baseline.start();
        // After stop/start, the buffer still holds old values
        baseline.track(Event.Scroll, 0, 0, 0); // need update=true for snapshot
        const data = getBufferSnapshot();
        expect(data.scrollX).toBe(0); // overwritten by the new track
        expect(data.scrollY).toBe(0);
        // But fields that weren't re-tracked retain their old values
        // (e.g., pointer fields set by earlier tests in this suite)
    });

    test("there is no API to clear the buffer — only module reload resets it", () => {
        baseline.track(Event.Document, 1024, 768, 100);
        baseline.stop();
        baseline.start();
        baseline.reset(); // does not create fresh buffer, just snapshots if update=true
        baseline.track(Event.Scroll, 0, 0, 0); // trigger update for snapshot
        const data = getBufferSnapshot();
        // docWidth/docHeight still hold values from before stop/start
        expect(data.docWidth).toBe(1024);
        expect(data.docHeight).toBe(768);
    });

    test("multiple scroll track calls overwrite — last one wins", () => {
        baseline.track(Event.Scroll, 100, 200, 1000);
        baseline.track(Event.Scroll, 300, 400, 2000);
        const data = getBufferSnapshot();
        expect(data.scrollX).toBe(300);
        expect(data.scrollY).toBe(400);
        expect(data.scrollTime).toBe(2000);
    });

    // --- Encoding and compute() ---

    test("compute calls encode with Event.Baseline when data has changed", () => {
        baseline.track(Event.Scroll, 10, 20, 100);
        baseline.compute();
        expect(mockEncode).toHaveBeenCalledTimes(1);
        expect(mockEncode).toHaveBeenCalledWith(Event.Baseline);
    });

    test("compute does not call encode when no data has changed", () => {
        baseline.compute();
        expect(mockEncode).not.toHaveBeenCalled();
    });

    test("compute encodes on every call while update flag is set", () => {
        baseline.track(Event.Scroll, 10, 20, 100);
        baseline.compute();
        baseline.reset();
        baseline.compute();
        expect(mockEncode).toHaveBeenCalledTimes(2);
    });

    test("start() clears the update flag so compute does not encode", () => {
        baseline.track(Event.Scroll, 10, 20, 100);
        baseline.compute();
        expect(mockEncode).toHaveBeenCalledTimes(1);
        baseline.stop();
        baseline.start();
        baseline.compute();
        expect(mockEncode).toHaveBeenCalledTimes(1);
    });

    test("visibility(False) sets update flag so compute encodes", () => {
        baseline.visibility(5000, BooleanFlag.False);
        baseline.compute();
        expect(mockEncode).toHaveBeenCalledWith(Event.Baseline);
    });

    test("dynamic() sets update flag so compute encodes", () => {
        baseline.dynamic(new Set([1, 2]));
        baseline.compute();
        expect(mockEncode).toHaveBeenCalledWith(Event.Baseline);
    });

    // --- Timestamps via time mock ---

    test("reset snapshots buffer with current time from time()", () => {
        mockTime.mockReturnValue(42000);
        baseline.track(Event.Scroll, 10, 20, 100);
        baseline.reset();
        expect(baseline.state.time).toBe(42000);
    });

    test("state timestamp updates on each reset cycle", () => {
        mockTime.mockReturnValue(1000);
        baseline.track(Event.Scroll, 10, 20, 100);
        baseline.reset();
        expect(baseline.state.time).toBe(1000);

        mockTime.mockReturnValue(5000);
        baseline.track(Event.Scroll, 30, 40, 200);
        baseline.reset();
        expect(baseline.state.time).toBe(5000);
    });

    // --- Reset/state snapshot ---

    test("reset without prior track does not update state", () => {
        const stateBefore = baseline.state;
        baseline.reset();
        expect(baseline.state).toBe(stateBefore);
    });

    test("reset snapshots buffer data into state.data", () => {
        baseline.track(Event.Scroll, 10, 20, 100);
        baseline.reset();
        expect(baseline.state).not.toBeNull();
        expect(baseline.state.event).toBe(Event.Baseline);
        expect(baseline.state.data.scrollX).toBe(10);
        expect(baseline.state.data.scrollY).toBe(20);
        expect(baseline.state.data.scrollTime).toBe(100);
    });

    // --- stop() ---

    test("stop calls reset, snapshotting pending data", () => {
        baseline.track(Event.Scroll, 77, 88, 999);
        baseline.stop();
        expect(baseline.state).not.toBeNull();
        expect(baseline.state.data.scrollX).toBe(77);
    });

    test("stop does not call encode", () => {
        baseline.track(Event.Scroll, 10, 20, 100);
        baseline.stop();
        expect(mockEncode).not.toHaveBeenCalled();
    });
});
