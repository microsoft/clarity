import { Privacy, Task, Timer } from "@clarity-types/core";
import { Event, Setting, Token } from "@clarity-types/data";
import { Constant, NodeInfo, NodeValue } from "@clarity-types/layout";
import config from "@src/core/config";
import scrub from "@src/core/scrub";
import * as task from "@src/core/task";
import { time } from "@src/core/time";
import tokenize from "@src/data/token";
import * as baseline from "@src/data/baseline";
import { queue } from "@src/data/upload";
import * as fraud from "@src/diagnostic/fraud";
import * as doc from "./document";
import * as dom from "./dom";
import * as region from "./region";

export default async function (type: Event, timer: Timer = null, ts: number = null): Promise<void> {
    let eventTime = ts || time()
    let tokens: Token[] = [eventTime, type];
    switch (type) {
        case Event.Document:
            let d = doc.data;
            tokens.push(d.width);
            tokens.push(d.height);
            baseline.track(type, d.width, d.height);
            queue(tokens);
            break;
        case Event.Region:
            for (let r of region.state) {
                tokens = [r.time, Event.Region];
                tokens.push(r.data.id);
                tokens.push(r.data.interaction);
                tokens.push(r.data.visibility);
                tokens.push(r.data.name);
                queue(tokens);
            }
            region.reset();
            break;
        case Event.Discover:
        case Event.Mutation:
            // Check if we are operating within the context of the current page
            if (task.state(timer) === Task.Stop) { break; }
            let values = dom.updates();
            // Only encode and queue DOM updates if we have valid updates to report back
            if (values.length > 0) {
                for (let value of values) {
                    let state = task.state(timer);
                    if (state === Task.Wait) { state = await task.suspend(timer); }
                    if (state === Task.Stop) { break; }
                    let data: NodeInfo = value.data;
                    let active = value.metadata.active;
                    let suspend = value.metadata.suspend;
                    let privacy = value.metadata.privacy;
                    let mangle = shouldMangle(value);
                    let keys = active ? ["tag", "attributes", "value"] : ["tag"];
                    for (let key of keys) {
                        if (data[key]) {
                            switch (key) {
                                case "tag":
                                    let box = size(value);
                                    let factor = mangle ? -1 : 1;
                                    tokens.push(value.id * factor);
                                    if (value.parent && active) { tokens.push(value.parent); }
                                    if (value.previous && active) { tokens.push(value.previous); }
                                    tokens.push(suspend ? Constant.SuspendMutationTag : data[key]);
                                    if (box && box.length === 2) { tokens.push(`${Constant.Hash}${str(box[0])}.${str(box[1])}`); }
                                    break;
                                case "attributes":
                                    for (let attr in data[key]) {
                                        if (data[key][attr] !== undefined) {
                                            tokens.push(attribute(attr, data[key][attr], privacy));
                                        }
                                    }
                                    break;
                                case "value":
                                    fraud.check(value.metadata.fraud, value.id, data[key]);
                                    tokens.push(scrub(data[key], data.tag, privacy, mangle));
                                    break;
                            }
                        }
                    }
                }
                if (type === Event.Mutation) { baseline.activity(eventTime); }
                queue(tokenize(tokens), !config.lean);
            }
            break;
    }
}

function shouldMangle(value: NodeValue): boolean {
    let privacy = value.metadata.privacy;
    return value.data.tag === Constant.TextTag && !(privacy === Privacy.None || privacy === Privacy.Sensitive);
}

function size(value: NodeValue): number[] {
    if (value.metadata.size !== null && value.metadata.size.length === 0) {
        let img = dom.getNode(value.id) as HTMLImageElement;
        if (img) {
            return [Math.floor(img.offsetWidth * Setting.BoxPrecision), Math.floor(img.offsetHeight * Setting.BoxPrecision)];
        }
    }
    return value.metadata.size;
}

function str(input: number): string {
    return input.toString(36);
}

function attribute(key: string, value: string, privacy: Privacy): string {
    return `${key}=${scrub(value, key, privacy)}`;
}
