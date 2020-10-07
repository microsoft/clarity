import { Event, Metric, Token } from "@clarity-types/data";
import { Constant, NodeInfo, Privacy } from "@clarity-types/layout";
import config from "@src/core/config";
import mask from "@src/core/mask";
import * as task from "@src/core/task";
import { time } from "@src/core/time";
import tokenize from "@src/data/token";
import * as baseline from "@src/data/baseline";
import { queue } from "@src/data/upload";
import * as box from "./box";
import * as region from "./region";
import * as doc from "./document";
import * as dom from "./dom";

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
                let keys = active ? ["tag", "path", "attributes", "value"] : ["tag"];
                for (let key of keys) {
                    if (data[key]) {
                        switch (key) {
                            case "tag":
                                let m = value.metadata;
                                tokens.push(value.id);
                                if (value.parent && active) { tokens.push(value.parent); }
                                if (value.previous && active) { tokens.push(value.previous); }
                                metadata.push(value.position ? `${data[key]}~${value.position}` : data[key]);
                                if (m.width && m.height) { metadata.push(`${Constant.Box}${str(m.width)}.${str(m.height)}`); }
                                break;
                            case "path":
                                metadata.push(`${value.data.path}>`);
                                break;
                            case "attributes":
                                for (let attr in data[key]) {
                                    if (data[key][attr] !== undefined) {
                                        metadata.push(attribute(value.metadata.privacy, attr, data[key][attr]));
                                    }
                                }
                                break;
                            case "value":
                                let parent = dom.getNode(value.parent);
                                let parentTag = dom.get(parent) ? dom.get(parent).data.tag : null;
                                let tag = value.data.tag === "STYLE" ? value.data.tag : parentTag;
                                metadata.push(text(value.metadata.privacy, tag, data[key]));
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

function str(input: number): string {
    return input.toString(36);
}

function attribute(privacy: Privacy, key: string, value: string): string {
    switch (key) {
        case "src":
        case "srcset":
        case "title":
        case "alt":
            return `${key}=${privacy === Privacy.MaskTextImage || privacy === Privacy.Exclude ? Constant.Empty : value}`;
        case "value":
        case "placeholder":
            return `${key}=${privacy !== Privacy.None ? mask(value) : value}`;
        default:
            return `${key}=${value}`;
    }
}

function text(privacy: Privacy, tag: string, value: string): string {
    switch (tag) {
        case "STYLE":
        case "TITLE":
            return value;
        default:
            return privacy !== Privacy.None ? mask(value) : value;
    }
}
