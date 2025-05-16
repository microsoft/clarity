import { Event, type Token } from "@clarity-types/data";
import { time } from "@src/core/time";
import * as baseline from "@src/data/baseline";
import * as custom from "@src/data/custom";
import * as dimension from "@src/data/dimension";
import * as extract from "@src/data/extract";
import * as limit from "@src/data/limit";
import * as metric from "@src/data/metric";
import * as ping from "@src/data/ping";
import * as summary from "@src/data/summary";
import * as upgrade from "@src/data/upgrade";
import * as variable from "@src/data/variable";
import { queue, track } from "./upload";

export default function (event: Event): void {
    const t = time();
    let tokens: Token[] = [t, event];
    switch (event) {
        case Event.Baseline:
            const b = baseline.state;
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
                tokens.push(b.data.scrollTime);
                tokens.push(b.data.pointerTime);
                tokens.push(b.data.moveX);
                tokens.push(b.data.moveY);
                tokens.push(b.data.moveTime);
                tokens.push(b.data.downX);
                tokens.push(b.data.downY);
                tokens.push(b.data.downTime);
                tokens.push(b.data.upX);
                tokens.push(b.data.upY);
                tokens.push(b.data.upTime);
                tokens.push(b.data.pointerPrevX);
                tokens.push(b.data.pointerPrevY);
                tokens.push(b.data.pointerPrevTime);
                queue(tokens, false);
            }
            baseline.reset();
            break;
        case Event.Ping:
            tokens.push(ping.data.gap);
            queue(tokens);
            break;
        case Event.Limit:
            tokens.push(limit.data.check);
            queue(tokens, false);
            break;
        case Event.Upgrade:
            tokens.push(upgrade.data.key);
            queue(tokens);
            break;
        case Event.Upload:
            tokens.push(track.sequence);
            tokens.push(track.attempts);
            tokens.push(track.status);
            queue(tokens, false);
            break;
        case Event.Custom:
            // not all custom events have a key - if it wasn't passed server handles just value
            custom.data.key && tokens.push(custom.data.key);
            tokens.push(custom.data.value);
            queue(tokens);
            break;
        case Event.Variable:
            const variableKeys = Object.keys(variable.data);
            if (variableKeys.length > 0) {
                for (const v of variableKeys) {
                    tokens.push(v);
                    tokens.push(variable.data[v]);
                }
                variable.reset();
                queue(tokens, false);
            }
            break;
        case Event.Metric:
            const metricKeys = Object.keys(metric.updates);
            if (metricKeys.length > 0) {
                for (const m of metricKeys) {
                    const key = Number.parseInt(m, 10);
                    tokens.push(key);
                    // For computation, we need microseconds precision that performance.now() API offers
                    // However, for data over the wire, we round it off to milliseconds precision.
                    tokens.push(Math.round(metric.updates[m]));
                }
                metric.reset();
                queue(tokens, false);
            }
            break;
        case Event.Dimension:
            const dimensionKeys = Object.keys(dimension.updates);
            if (dimensionKeys.length > 0) {
                for (const d of dimensionKeys) {
                    const key = Number.parseInt(d, 10);
                    tokens.push(key);
                    tokens.push(dimension.updates[d]);
                }
                dimension.reset();
                queue(tokens, false);
            }
            break;
        case Event.Summary:
            const eventKeys = Object.keys(summary.data);
            if (eventKeys.length > 0) {
                for (const e of eventKeys) {
                    const key = Number.parseInt(e, 10);
                    tokens.push(key);
                    tokens.push([].concat(...summary.data[e]));
                }
                summary.reset();
                queue(tokens, false);
            }
            break;
        case Event.Extract:
            const extractKeys = extract.keys;
            extractKeys.forEach((e) => {
                tokens.push(e);
                const token = [];
                for (const d in extract.data[e]) {
                    const key = Number.parseInt(d, 10);
                    token.push(key);
                    token.push(extract.data[e][d]);
                }
                tokens.push(token);
            });

            extract.reset();
            queue(tokens, false);
    }
}
