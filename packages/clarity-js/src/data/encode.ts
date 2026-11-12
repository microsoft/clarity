import { Event, Token } from "@clarity-types/data";
import { time } from "@src/core/time";
import * as baseline from "@src/data/baseline";
import * as consent from "@src/data/consent";
import * as custom from "@src/data/custom";
import * as dimension from "@src/data/dimension";
import * as limit from "@src/data/limit";
import * as metric from "@src/data/metric";
import * as ping from "@src/data/ping";
import * as summary from "@src/data/summary";
import * as upgrade from "@src/data/upgrade";
import * as variable from "@src/data/variable";
import * as extract from "@src/data/extract";
import { queue, track } from "./upload";

export default function (event: Event): void {
    const t = time();
    let tokens: Token[] = [t, event];
    switch (event) {
        case Event.Baseline: {
            const b = baseline.state;
            if (b && b.data) {
                let d = b.data;
                tokens = [b.time, b.event];
                tokens.push(
                    d.visible, d.docWidth, d.docHeight,
                    d.screenWidth, d.screenHeight,
                    d.scrollX, d.scrollY,
                    d.pointerX, d.pointerY,
                    d.activityTime, d.scrollTime,
                    d.pointerTime,
                    d.moveX, d.moveY, d.moveTime,
                    d.downX, d.downY, d.downTime,
                    d.upX, d.upY, d.upTime,
                    d.pointerPrevX, d.pointerPrevY, d.pointerPrevTime,
                    d.modules
                );
                queue(tokens, false);
            }
            baseline.reset();
            break;
        }
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
            tokens.push(track.sequence, track.attempts, track.status);
            queue(tokens, false);
            break;
        case Event.Custom:
            // not all custom events have a key - if it wasn't passed server handles just value
            custom.data.key && tokens.push(custom.data.key);
            tokens.push(custom.data.value);
            queue(tokens);
            break;
        case Event.Variable: {
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
        }
        case Event.Metric: {
            const metricKeys = Object.keys(metric.updates);
            if (metricKeys.length > 0) {
                for (const m of metricKeys) {
                    const key = parseInt(m, 10);
                    tokens.push(key);
                    // For computation, we need microseconds precision that performance.now() API offers
                    // However, for data over the wire, we round it off to milliseconds precision.
                    tokens.push(Math.round(metric.updates[m]));
                }
                metric.reset();
                queue(tokens, false);
            }
            break;
        }
        case Event.Dimension: {
            const dimensionKeys = Object.keys(dimension.updates);
            if (dimensionKeys.length > 0) {
                for (const d of dimensionKeys) {
                    const key = parseInt(d, 10);
                    tokens.push(key);
                    tokens.push(dimension.updates[d]);
                }
                dimension.reset();
                queue(tokens, false);
            }
            break;
        }
        case Event.Summary: {
            const eventKeys = Object.keys(summary.data);
            if (eventKeys.length > 0) {
                for (const e of eventKeys) {
                    const key = parseInt(e, 10);
                    tokens.push(key);
                    tokens.push([].concat(...summary.data[e]));
                }
                summary.reset();
                queue(tokens, false);
            }
            break;
        }
        case Event.Extract: {
            const extractKeys = extract.keys;
            extractKeys.forEach(e => {
                tokens.push(e);
                const token = []
                for (const d in extract.data[e]) {
                    const key = parseInt(d, 10);
                    token.push(key);
                    token.push(extract.data[e][d]);
                }
                tokens.push(token);
            });

            extract.reset();
            queue(tokens, false);
            break;
        }
        case Event.Consent:
            tokens.push(consent.data.source, consent.data.ad_Storage, consent.data.analytics_Storage);
            queue(tokens, false);
            break;
    }
}
