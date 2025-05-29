let startTime = 0;

export function start(): void {
    startTime = performance.now() + performance.timeOrigin;
}

// event.timestamp is number of milliseconds elapsed since the document was loaded
// since iframes can be loaded later the event timestamp is not the same as performance.now()
// converting everything to absolute time by adding timeorigin of the event view
// to synchronize times before calculating the difference with start time
export function time(event: UIEvent | PageTransitionEvent = null): number {
    const ts = event && event.timeStamp > 0 ? event.timeStamp : performance.now();
    const origin = event && (event as UIEvent).view ? (event as UIEvent).view.performance.timeOrigin : performance.timeOrigin;
    return Math.max(Math.round(ts + origin - startTime), 0);
}

export function stop(): void {
    startTime = 0;
}
