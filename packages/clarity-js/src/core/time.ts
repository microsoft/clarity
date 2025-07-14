let startTime = 0;

function computeStartTime(): number {
    return performance.now() + performance.timeOrigin;
}

export function start(): void {
    startTime = computeStartTime();
}

// event.timestamp is number of milliseconds elapsed since the document was loaded
// since iframes can be loaded later the event timestamp is not the same as performance.now()
// converting everything to absolute time by adding timeorigin of the event view
// to synchronize times before calculating the difference with start time
export function time(event: UIEvent | PageTransitionEvent = null): number {
    // If startTime is 0, Clarity hasn't been started or has been stopped
    // Use a local baseline to maintain relative timing semantics without affecting global state
    let baseline = startTime === 0 ? computeStartTime() : startTime;
    let ts = event && event.timeStamp > 0 ? event.timeStamp : performance.now();
    let origin = event && (event as UIEvent).view ? (event as UIEvent).view.performance.timeOrigin : performance.timeOrigin;
    return Math.max(Math.round(ts + origin - baseline), 0);
}

export function stop(): void {
    startTime = 0;
}
