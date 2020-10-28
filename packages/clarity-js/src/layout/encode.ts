import { Privacy } from "@clarity-types/core";
import { Event, Metric, Token } from "@clarity-types/data";
import { Constant, NodeInfo, NodeValue } from "@clarity-types/layout";
import config from "@src/core/config";
import scrub from "@src/core/scrub";
import * as task from "@src/core/task";
import { time } from "@src/core/time";
import tokenize from "@src/data/token";
import * as baseline from "@src/data/baseline";
import { queue } from "@src/data/upload";
import * as box from "./box";
import * as doc from "./document";
import * as dom from "./dom";
import * as region from "./region";

export default async function (type: Event, ts: number = null): Promise<void> {
    let eventTime = ts || time()
    let tokens: Token[] = [eventTime, type];
    let timer = Metric.LayoutCost;
    switch (type) {
        case Event.Document:
            let d = doc.data;
            tokens.push(d.width);
            tokens.push(d.height);
            baseline.track(type, d.width, d.height);
            queue(tokens);
            break;
        case Event.Region:
            let bm = region.updates();
            for (let value of bm) {
                tokens.push(value.id);
                tokens.push([value.box.x, value.box.y, value.box.w, value.box.h, value.box.v]);
                tokens.push(value.region);
            }
            queue(tokens);
            break;
        case Event.Box:
            let b = box.data;
            for (let entry of b) {
                tokens.push(entry.id);
                tokens.push(entry.width);
                tokens.push(entry.height);
            }
            box.reset();
            queue(tokens);
            break;
        case Event.Discover:
        case Event.Mutation:
            let values = dom.updates();
            for (let value of values) {
                if (task.shouldYield(timer)) { await task.suspend(timer); }
                let metadata = [];
                let data: NodeInfo = value.data;
                let active = value.metadata.active;
                let privacy = value.metadata.privacy;
                let mangle = shouldMangle(value);
                let keys = active ? ["tag", "path", "attributes", "value"] : ["tag"];
                box.compute(value.id);
                for (let key of keys) {
                    if (data[key]) {
                        switch (key) {
                            case "tag":
                                let size = value.metadata.size;
                                let factor = mangle ? -1 : 1;
                                tokens.push(value.id * factor);
                                if (value.parent && active) { tokens.push(value.parent); }
                                if (value.previous && active) { tokens.push(value.previous); }
                                metadata.push(value.position ? `${data[key]}~${value.position}` : data[key]);
                                if (size && size.length === 2) { metadata.push(`${Constant.Box}${str(size[0])}.${str(size[1])}`); }
                                break;
                            case "path":
                                metadata.push(`${value.data.path}>`);
                                break;
                            case "attributes":
                                for (let attr in data[key]) {
                                    if (data[key][attr] !== undefined) {
                                        metadata.push(attribute(attr, data[key][attr], privacy));
                                    }
                                }
                                break;
                            case "value":
                                metadata.push(scrub(data[key], data.tag, privacy, mangle));
                                break;
                        }
                    }
                }
                tokens = tokenize(tokens, metadata);
            }
            if (type === Event.Mutation) { baseline.activity(eventTime); }
            queue(tokens, !config.lean);
            break;
    }
}

function shouldMangle(value: NodeValue): boolean {
    let privacy = value.metadata.privacy;
    return value.data.tag === Constant.TextTag && !(privacy === Privacy.None || privacy === Privacy.Sensitive);
}

function str(input: number): string {
    return input.toString(36);
}

function attribute(key: string, value: string, privacy: Privacy): string {
    return `${key}=${scrub(value, key, privacy)}`;
}
