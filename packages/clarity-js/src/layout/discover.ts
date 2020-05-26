import { Priority } from "@clarity-types/core";
import { Event, Metric } from "@clarity-types/data";
import { Source } from "@clarity-types/layout";
import measure from "@src/core/measure";
import * as task from "@src/core/task";
import { time } from "@src/core/time";
import * as boxmodel from "@src/layout/boxmodel";
import * as doc from "@src/layout/document";
import encode from "@src/layout/encode";
import traverse from "@src/layout/traverse";

export function start(): void {
    task.schedule(discover, Priority.High).then((): void => {
        measure(doc.compute)();
        measure(boxmodel.compute)();
    });
}

async function discover(): Promise<void> {
    let ts = time();
    let timer = Metric.DiscoverDuration;
    task.start(timer);
    await traverse(document, timer, Source.Discover);
    await encode(Event.Discover, ts);
    task.stop(timer);
}
