import { Event, Token, Metric, BooleanFlag } from "@clarity-types/data";
import { time } from "@src/core/time";
import * as baseline from "@src/data/baseline";
import * as dimension from "@src/data/dimension";
import * as metric from "@src/data/metric";
import * as ping from "@src/data/ping";
import * as tag from "@src/data/tag";
import * as upgrade from "@src/data/upgrade";
import { queue, track } from "./upload";

export default function(event: Event): void {
    let t = time();
    let tokens: Token[] = [t, event];
    switch (event) {
        case Event.Baseline:
            let b = baseline.state;
            if (b) {
                tokens = [b.time, b.event];
                tokens.push(b.data.visible);
                tokens.push(b.data.docWidth);
                tokens.push(b.data.docHeight);
                tokens.push(b.data.screenWidth);
                tokens.push(b.data.screenHeight);
                tokens.push(b.data.scrollX);
                tokens.push(b.data.scrollY);
                tokens.push(b.data.pointerX);
                tokens.push(b.data.pointerY);
                tokens.push(b.data.activityTime);
                queue(tokens);
            }
            baseline.reset();
            break;
        case Event.Ping:
            tokens.push(ping.data.gap);
            queue(tokens);
            break;
        case Event.Tag:
            tokens.push(tag.data.key);
            tokens.push(tag.data.value);
            queue(tokens);
            break;
        case Event.Upgrade:
            metric.max(Metric.Playback, BooleanFlag.True);
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
            let metricKeys = Object.keys(metric.updates);
            if (metricKeys.length > 0) {
                for (let m of metricKeys) {
                    let key = parseInt(m, 10);
                    tokens.push(key);
                    // For computation, we need microseconds precision that performance.now() API offers
                    // However, for data over the wire, we round it off to milliseconds precision.
                    tokens.push(Math.round(metric.updates[m]));
                }
                metric.reset();
                queue(tokens);
            }
            break;
        case Event.Dimension:
            let dimensionKeys = Object.keys(dimension.updates);
            if (dimensionKeys.length > 0) {
                for (let d of dimensionKeys) {
                    let key = parseInt(d, 10);
                    tokens.push(key);
                    tokens.push(dimension.updates[d]);
                }
                dimension.reset();
                queue(tokens);
            }
            break;
    }
}
