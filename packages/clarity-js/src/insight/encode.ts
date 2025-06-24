import { Privacy } from "@clarity-types/core";
import { Event, Token } from "@clarity-types/data";
import { Constant, NodeInfo } from "@clarity-types/layout";
import * as scrub from "@src/core/scrub";
import { time } from "@src/core/time";
import * as baseline from "@src/data/baseline";
import tokenize from "@src/data/token";
import { queue } from "@src/data/upload";
import * as snapshot from "@src/insight/snapshot";
import * as doc from "@src/layout/document";

export default async function (type: Event): Promise<void> {
    let eventTime = time()
    let tokens: Token[] = [eventTime, type];
    switch (type) {
        case Event.Document:
            let d = doc.data;
            tokens.push(d.width);
            tokens.push(d.height);
            baseline.track(type, d.width, d.height);
            queue(tokens);
            break;
        case Event.Snapshot:
            let values = snapshot.values;
            // Only encode and queue DOM updates if we have valid updates to report back
            if (values.length > 0) {
                for (let value of values) {
                    let privacy = value.metadata.privacy;
                    let data: NodeInfo = value.data;
                    for (let key of ["tag", "attributes", "value"]) {
                        if (data[key]) {
                            switch (key) {
                                case "tag":
                                    tokens.push(value.id);
                                    if (value.parent) { tokens.push(value.parent); }
                                    if (value.previous) { tokens.push(value.previous); }
                                    tokens.push(data[key]);
                                    break;
                                case "attributes":
                                    for (let attr in data[key]) {
                                        if (data[key][attr] !== undefined) {
                                            tokens.push(attribute(attr, data[key][attr], privacy));
                                        }
                                    }
                                    break;
                                case "value":
                                    tokens.push(scrub.text(data[key], data.tag, privacy));
                                    break;
                            }
                        }
                    }
                }
                queue(tokenize(tokens), true);
            }
            break;
    }
}

function attribute(key: string, value: string, privacy: Privacy): string {
    return `${key}=${scrub.text(value, key.indexOf(Constant.DataAttribute) === 0 ? Constant.DataAttribute : key, privacy)}`;
}