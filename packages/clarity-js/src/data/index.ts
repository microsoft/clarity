import measure from "@src/core/measure";
import * as baseline from "@src/data/baseline";
import * as envelope from "@src/data/envelope";
import * as dimension from "@src/data/dimension";
import * as metadata from "@src/data/metadata";
import { Module } from "@clarity-types/core";
import * as metric from "@src/data/metric";
import * as ping from "@src/data/ping";
import * as limit from "@src/data/limit";
import * as summary from "@src/data/summary";
import * as upgrade from "@src/data/upgrade";
import * as upload from "@src/data/upload";
import * as variable from "@src/data/variable";
export { event } from "@src/data/custom";
export { consent, metadata } from "@src/data/metadata";
export { upgrade } from "@src/data/upgrade";
export { set, identify } from "@src/data/variable";

const modules: Module[] = [baseline, dimension, variable, limit, summary, metadata, envelope, upload, ping, upgrade];

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
    variable.compute();
    baseline.compute();
    dimension.compute();
    metric.compute();
    summary.compute();
    limit.compute();
}
