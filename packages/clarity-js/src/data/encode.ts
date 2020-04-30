import { Event, Token } from "@clarity-types/data";
import { time } from "@src/core/time";
import { metadata } from "@src/data/metadata";
import * as metric from "@src/data/metric";
import * as ping from "@src/data/ping";
import * as tag from "@src/data/tag";
import * as target from "@src/data/target";
import * as upgrade from "@src/data/upgrade";
import { queue, track } from "./upload";

export default function(event: Event): void {
    let t = time();
    let tokens: Token[] = [t, event];
    switch (event) {
        case Event.Ping:
            tokens.push(ping.data.gap);
            queue(tokens);
            break;
        case Event.Page:
            tokens.push(metadata.page.timestamp);
            tokens.push(metadata.page.ua);
            tokens.push(metadata.page.url);
            tokens.push(metadata.page.referrer);
            tokens.push(metadata.page.lean);
            queue(tokens);
            break;
        case Event.Tag:
            tokens.push(tag.data.key);
            tokens.push(tag.data.value);
            queue(tokens);
            break;
        case Event.Target:
            let targets = target.updates();
            if (targets.length > 0) {
                for (let value of targets) {
                    tokens.push(value.id);
                    tokens.push(value.hash);
                    tokens.push(value.box);
                    tokens.push(value.region);
                }
                queue(tokens);
            }
            break;
        case Event.Upgrade:
            tokens.push(upgrade.data.key);
            queue(tokens);
            break;
        case Event.Upload:
            tokens.push(track.sequence);
            tokens.push(track.attempts);
            tokens.push(track.status);
            queue(tokens);
            break;
        case Event.Metric:
            if (metric.updates.length > 0) {
                for (let d in metric.data) {
                    if (metric.data[d]) {
                        let m = parseInt(d, 10);
                        if (metric.updates.indexOf(m) >= 0) {
                            tokens.push(m);
                            // For computation, we need microseconds precision that performance.now() API offers
                            // However, for data over the wire, we round it off to milliseconds precision.
                            tokens.push(Math.round(metric.data[d]));
                        }
                    }
                }
                metric.reset();
                queue(tokens);
            }
            break;
    }
}
