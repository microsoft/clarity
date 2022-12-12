let startTime = 0;

export function start(): void {
    startTime = performance.now();
}

export function time(event: UIEvent = null): number {
    let ts = event && event.timeStamp > 0 ? event.timeStamp : performance.now();
    return Math.max(Math.round(ts - startTime), 0);
}

export function stop(): void {
    startTime = 0;
}
