let startTime = 0;

export function start(): void {
    startTime = performance.now();
}

export function time(ts: number = null): number {
    ts = ts ? ts : performance.now();
    return Math.max(Math.round(ts - startTime), 0);
}

export function stop(): void {
    startTime = 0;
}
