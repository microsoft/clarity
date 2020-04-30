let startTime = 0;

export function start(): void {
    startTime = performance.now();
}

export function time(): number {
    return Math.round(performance.now() - startTime);
}

export function end(): void {
    startTime = 0;
}
