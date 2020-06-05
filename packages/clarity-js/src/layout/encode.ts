import {Event, Metric, Token} from "@clarity-types/data";
import {Constant, NodeInfo} from "@clarity-types/layout";
import mask from "@src/core/mask";
import * as task from "@src/core/task";
import { time } from "@src/core/time";
import tokenize from "@src/data/token";
import { queue } from "@src/data/upload";
import * as region from "./region";
import * as doc from "./document";
import * as dom from "./dom";

export default async function(type: Event, ts: number = null): Promise<void> {
    let tokens: Token[] = [ts || time(), type];
    let timer = Metric.LayoutCost;
    switch (type) {
        case Event.Document:
            let d = doc.data;
            tokens.push(d.width);
            tokens.push(d.height);
            queue(tokens);
            break;
        case Event.Region:
            let bm = region.updates();
            for (let value of bm) {
                tokens.push(value.id);
                tokens.push(value.box);
                tokens.push(value.region);
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
                                tokens.push(value.id);
                                if (value.parent && active) { tokens.push(value.parent); }
                                if (value.previous && active) { tokens.push(value.previous); }
                                metadata.push(value.position ? `${data[key]}~${value.position}` : data[key]);
                                break;
                            case "path":
                                metadata.push(`${value.data.path}>`);
                                break;
                            case "attributes":
                                for (let attr in data[key]) {
                                    if (data[key][attr] !== undefined) {
                                        metadata.push(attribute(value.metadata.masked, attr, data[key][attr]));
                                    }
                                }
                                break;
                            case "value":
                                let parent = dom.getNode(value.parent);
                                let parentTag = dom.get(parent) ? dom.get(parent).data.tag : null;
                                let tag = value.data.tag === "STYLE" ? value.data.tag : parentTag;
                                metadata.push(text(value.metadata.masked, tag, data[key]));
                                break;
                        }
                    }
                }
                tokens = tokenize(tokens, metadata);
            }

            queue(tokens);
            break;
        }
}

function attribute(masked: boolean, key: string, value: string): string {
    switch (key) {
        case "src":
        case "srcset":
        case "title":
        case "alt":
            return `${key}=${masked ? Constant.EMPTY_STRING : value}`;
        case "value":
        case "placeholder":
            return `${key}=${masked ? mask(value) : value}`;
        default:
            return `${key}=${value}`;
    }
}

function text(masked: boolean, tag: string, value: string): string {
    switch (tag) {
        case "STYLE":
        case "TITLE":
            return value;
        default:
            return masked ? mask(value) : value;
    }
}
