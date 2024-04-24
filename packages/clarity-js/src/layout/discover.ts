import { Priority, Timer } from "@clarity-types/core";
import { Event, Metric } from "@clarity-types/data";
import { Source } from "@clarity-types/layout";
import measure from "@src/core/measure";
import * as task from "@src/core/task";
import { time } from "@src/core/time";
import { id } from "@src/data/metadata";
import * as doc from "@src/layout/document";
import encode from "@src/layout/encode";
import * as region from "@src/layout/region";
import traverse from "@src/layout/traverse";
import { checkDocumentStyles } from "@src/layout/style";
import * as scroll from "src/interaction/scroll";

export function start(): void {
    task.schedule(discover, Priority.High).then((): void => {
        measure(doc.compute)();
        measure(region.compute)();
        measure(scroll.compute)();
    });
}

async function discover(): Promise<void> {
    let ts = time();
    let timer: Timer = { id: id(), cost: Metric.LayoutCost };
    task.start(timer);
    await traverse(document, timer, Source.Discover, ts);
    checkDocumentStyles(document, ts);
    await encode(Event.Discover, timer, ts);
    task.stop(timer);
}
