import { Privacy, Task, type Timer } from "@clarity-types/core";
import { Event, Setting, type Token } from "@clarity-types/data";
import { Constant, type NodeInfo, type NodeValue } from "@clarity-types/layout";
import config from "@src/core/config";
import * as scrub from "@src/core/scrub";
import * as task from "@src/core/task";
import { time } from "@src/core/time";
import * as baseline from "@src/data/baseline";
import tokenize from "@src/data/token";
import { queue } from "@src/data/upload";
import * as fraud from "@src/diagnostic/fraud";
import * as animation from "@src/layout/animation";
import * as doc from "@src/layout/document";
import * as dom from "@src/layout/dom";
import * as region from "@src/layout/region";
import * as style from "@src/layout/style";

export default async function (type: Event, timer: Timer = null, ts: number = null): Promise<void> {
    const eventTime = ts || time();
    let tokens: Token[] = [eventTime, type];
    switch (type) {
        case Event.Document: {
            const d = doc.data;
            tokens.push(d.width);
            tokens.push(d.height);
            baseline.track(type, d.width, d.height);
            queue(tokens);
            break;
        }
        case Event.Region:
            for (const r of region.state) {
                tokens = [r.time, Event.Region];
                tokens.push(r.data.id);
                tokens.push(r.data.interaction);
                tokens.push(r.data.visibility);
                tokens.push(r.data.name);
                queue(tokens);
            }
            region.reset();
            break;
        case Event.StyleSheetAdoption:
        case Event.StyleSheetUpdate:
            for (const entry of style.sheetAdoptionState) {
                tokens = [entry.time, entry.event];
                tokens.push(entry.data.id);
                tokens.push(entry.data.operation);
                tokens.push(entry.data.newIds);
                queue(tokens);
            }
            for (const entry of style.sheetUpdateState) {
                tokens = [entry.time, entry.event];
                tokens.push(entry.data.id);
                tokens.push(entry.data.operation);
                tokens.push(entry.data.cssRules);
                queue(tokens);
            }
            style.reset();
            break;
        case Event.Animation:
            for (const entry of animation.state) {
                tokens = [entry.time, entry.event];
                tokens.push(entry.data.id);
                tokens.push(entry.data.operation);
                tokens.push(entry.data.keyFrames);
                tokens.push(entry.data.timing);
                tokens.push(entry.data.timeline);
                tokens.push(entry.data.targetId);
                queue(tokens);
            }
            animation.reset();
            break;
        case Event.Discover:
        case Event.Mutation: {
            // Check if we are operating within the context of the current page
            if (task.state(timer) === Task.Stop) {
                break;
            }
            const values = dom.updates();
            // Only encode and queue DOM updates if we have valid updates to report back
            if (values.length > 0) {
                for (const value of values) {
                    let state = task.state(timer);
                    if (state === Task.Wait) {
                        state = await task.suspend(timer);
                    }
                    if (state === Task.Stop) {
                        break;
                    }
                    const data: NodeInfo = value.data;
                    const active = value.metadata.active;
                    const suspend = value.metadata.suspend;
                    const privacy = value.metadata.privacy;
                    const mangle = shouldMangle(value);
                    const keys = active ? ["tag", "attributes", "value"] : ["tag"];
                    for (const key of keys) {
                        // we check for data[key] === '' because we want to encode empty strings as well, especially for value - which if skipped can cause our decoder to assume the final
                        // attribute was the value for the node
                        if (data[key] || data[key] === "") {
                            switch (key) {
                                case "tag": {
                                    const box = size(value);
                                    const factor = mangle ? -1 : 1;
                                    tokens.push(value.id * factor);
                                    if (value.parent && active) {
                                        tokens.push(value.parent);
                                        if (value.previous) {
                                            tokens.push(value.previous);
                                        }
                                    }
                                    tokens.push(suspend ? Constant.SuspendMutationTag : data[key]);
                                    if (box && box.length === 2) {
                                        tokens.push(`${Constant.Hash}${str(box[0])}.${str(box[1])}`);
                                    }
                                    break;
                                }
                                case "attributes":
                                    for (const attr in data[key]) {
                                        if (data[key][attr] !== undefined) {
                                            tokens.push(attribute(attr, data[key][attr], privacy));
                                        }
                                    }
                                    break;
                                case "value":
                                    fraud.check(value.metadata.fraud, value.id, data[key]);
                                    tokens.push(scrub.text(data[key], data.tag, privacy, mangle));
                                    break;
                            }
                        }
                    }
                }
                if (type === Event.Mutation) {
                    baseline.activity(eventTime);
                }
                queue(tokenize(tokens), !config.lean);
            }
            break;
        }
    }
}

function shouldMangle(value: NodeValue): boolean {
    const privacy = value.metadata.privacy;
    return value.data.tag === Constant.TextTag && !(privacy === Privacy.None || privacy === Privacy.Sensitive);
}

function size(value: NodeValue): number[] {
    if (value.metadata.size !== null && value.metadata.size.length === 0) {
        const img = dom.getNode(value.id) as HTMLImageElement;
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
    return `${key}=${scrub.text(value, key.indexOf(Constant.DataAttribute) === 0 ? Constant.DataAttribute : key, privacy)}`;
}
