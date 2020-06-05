import measure from "@src/core/measure";
import * as envelope from "@src/data/envelope";
import * as dimension from "@src/data/dimension";
import * as metadata from "@src/data/metadata";
import * as metric from "@src/data/metric";
import * as ping from "@src/data/ping";
import * as tag from "@src/data/tag";
import * as upgrade from "@src/data/upgrade";
import * as upload from "@src/data/upload";
export { consent, metadata } from "@src/data/metadata";
export { tag } from "@src/data/tag";
export { upgrade } from "@src/data/upgrade";

export function start(): void {
    metric.start();
    dimension.start();
    measure(upload.start)();
    measure(metadata.start)();
    measure(envelope.start)();
    measure(ping.start)();
    measure(tag.reset)();
    measure(upgrade.reset)();
}

export function end(): void {
    // The ordering below should respect inter-module dependency.
    // E.g. if upgrade depends on upload, then upgrade needs to end before upload.
    // Similarly, if upload depends on metadata, upload needs to end before metadata.
    measure(upgrade.reset)();
    measure(tag.reset)();
    measure(ping.end)();
    measure(upload.end)();
    measure(envelope.end)();
    measure(metadata.end)();
    dimension.end();
    metric.end();
}
