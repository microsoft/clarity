import { Event, Metric, TargetInfo, Token } from "@clarity-types/data";
import * as task from "@src/core/task";
import { time } from "@src/core/time";
import { observe, track } from "@src/data/target";
import tokenize from "@src/data/token";
import { queue } from "@src/data/upload";
import { getMatch } from "@src/layout/dom";
import * as connection from "@src/performance/connection";
import * as contentfulPaint from "@src/performance/contentfulPaint";
import * as longtask from "@src/performance/longtask";
import * as memory from "@src/performance/memory";
import * as navigation from "@src/performance/navigation";
import * as network from "@src/performance/network";
import * as paint from "@src/performance/paint";

export default async function (type: Event): Promise<void> {
    let t = time();
    let tokens: Token[] = [t, type];
    let timer = Metric.PerformanceDuration;
    task.start(timer);
    switch (type) {
        case Event.Connection:
            tokens.push(connection.data.downlink);
            tokens.push(connection.data.rtt);
            tokens.push(connection.data.saveData);
            tokens.push(connection.data.type);
            connection.reset();
            queue(tokens);
            break;
        case Event.ContentfulPaint:
            // Ensure that there's valid data before processing this event
            // This is different from others because we use the schedule call to queue up encoding
            // In an edge case, where clarity may tear down before this gets a chance to run, data will be null.
            if (contentfulPaint.data) {
                tokens.push(contentfulPaint.data.load);
                tokens.push(contentfulPaint.data.render);
                tokens.push(contentfulPaint.data.size);
                tokens.push(observe(contentfulPaint.data.target as TargetInfo));
                contentfulPaint.reset();
                queue(tokens);
            }
            break;
        case Event.LongTask:
            tokens = [longtask.state.time, type];
            tokens.push(longtask.state.data.duration);
            tokens.push(longtask.state.data.attributionName);
            tokens.push(longtask.state.data.attributionContainer);
            tokens.push(longtask.state.data.attributionType);
            tokens.push(longtask.state.data.name);
            longtask.reset();
            queue(tokens);
            break;
        case Event.Memory:
            tokens.push(memory.data.limit);
            tokens.push(memory.data.available);
            tokens.push(memory.data.consumed);
            queue(tokens);
            break;
        case Event.Navigation:
            tokens.push(navigation.data.fetchStart);
            tokens.push(navigation.data.connectStart);
            tokens.push(navigation.data.connectEnd);
            tokens.push(navigation.data.requestStart);
            tokens.push(navigation.data.responseStart);
            tokens.push(navigation.data.responseEnd);
            tokens.push(navigation.data.domInteractive);
            tokens.push(navigation.data.domComplete);
            tokens.push(navigation.data.loadEventStart);
            tokens.push(navigation.data.loadEventEnd);
            tokens.push(navigation.data.redirectCount);
            tokens.push(navigation.data.size);
            tokens.push(navigation.data.type);
            tokens.push(navigation.data.protocol);
            tokens.push(navigation.data.encodedSize);
            tokens.push(navigation.data.decodedSize);
            navigation.reset();
            queue(tokens);
            break;
        case Event.Network:
            if (network.state.length > 0) {
                for (let state of network.state) {
                    if (task.shouldYield(timer)) { await task.suspend(timer); }
                    let data = state.data;
                    data.target = observe(track(getMatch(state.url)));
                    let metadata = [];
                    let keys = ["start", "duration", "size", "target", "initiator", "protocol", "host"];
                    for (let key of keys) {
                        switch (key) {
                            case "target":
                                if (data[key]) { tokens.push(data[key] as number); }
                                break;
                            case "initiator":
                            case "protocol":
                            case "host":
                                metadata.push(data[key]);
                                break;
                            default:
                                tokens.push(data[key]);
                                break;
                        }
                    }
                    tokens = tokenize(tokens, metadata);
                }
                queue(tokens);
                network.reset();
            }
            break;
        case Event.Paint:
            tokens = [paint.state.time, type];
            tokens.push(paint.state.data.name);
            paint.reset();
            queue(tokens);
            break;
    }
    task.stop(timer);
}
