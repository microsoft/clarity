import measure from "@src/core/measure";
import { start as baseStart, stop as baseStop, compute as baseCompute } from "@src/data/baseline";
import { start as conStart, stop as conStop, compute as conCompute } from "@src/data/consent";
import { start as envStart, stop as envStop } from "@src/data/envelope";
import { start as dimStart, stop as dimStop, compute as dimCompute } from "@src/data/dimension";
import { start as metaStart, stop as metaStop } from "@src/data/metadata";
import { Module } from "@clarity-types/core";
import * as metric from "@src/data/metric";
import { start as pingStart, stop as pingStop } from "@src/data/ping";
import { start as limStart, stop as limStop, compute as limCompute } from "@src/data/limit";
import { start as sumStart, stop as sumStop, compute as sumCompute } from "@src/data/summary";
import { start as upgrStart, stop as upgrStop } from "@src/data/upgrade";
import { start as uplStart, stop as uplStop } from "@src/data/upload";
import { start as varStart, stop as varStop, compute as varCompute } from "@src/data/variable";
import { start as extStart, stop as extStop, compute as extCompute } from "@src/data/extract";
import { start as cookStart, stop as cookStop } from "@src/data/cookie";
export { event } from "@src/data/custom";
export { consent, consentv2, metadata } from "@src/data/metadata";
export { upgrade } from "@src/data/upgrade";
export { set, identify } from "@src/data/variable";
export { signal } from "@src/data/signal";
export { max as maxMetric } from "@src/data/metric";
export { log as dlog } from "@src/data/dimension";

const modules: Module[] = [
    { start: baseStart, stop: baseStop },
    { start: dimStart, stop: dimStop },
    { start: varStart, stop: varStop },
    { start: limStart, stop: limStop },
    { start: sumStart, stop: sumStop },
    { start: cookStart, stop: cookStop },
    { start: conStart, stop: conStop },
    { start: metaStart, stop: metaStop },
    { start: envStart, stop: envStop },
    { start: uplStart, stop: uplStop },
    { start: pingStart, stop: pingStop },
    { start: upgrStart, stop: upgrStop },
    { start: extStart, stop: extStop },
];

export function start(): void {
    // Metric needs to be initialized before we can start measuring. so metric is not wrapped in measure
    metric.start();
    modules.forEach(x => measure(x.start)());
}

export function stop(): void {
    // Stop modules in the reverse order of their initialization
    // The ordering below should respect inter-module dependency.
    // E.g. if upgrade depends on upload, then upgrade needs to end before upload.
    // Similarly, if upload depends on metadata, upload needs to end before metadata.
    modules.slice().reverse().forEach(x => measure(x.stop)());
    metric.stop();
}

export function compute(): void {
    varCompute();
    baseCompute();
    dimCompute();
    metric.compute();
    sumCompute();
    limCompute();
    extCompute();
    conCompute();
}
