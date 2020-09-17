import { helper, Data, Layout } from "clarity-js";
import { DomData, LayoutEvent } from "../types/layout";

let placeholderImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNiOAMAANUAz5n+TlUAAAAASUVORK5CYII=";
let hashes: { [key: number]: string } = {};

export function reset(): void {
    hashes = {};
}

export function decode(tokens: Data.Token[]): LayoutEvent {
    let time = tokens[0] as number;
    let event = tokens[1] as Data.Event;

    switch (event) {
        case Data.Event.Document:
            let documentData: Layout.DocumentData = { width: tokens[2] as number, height: tokens[3] as number };
            return { time, event, data: documentData };
        case Data.Event.Region:
            let regionData: Layout.RegionData[] = [];
            for (let i = 2; i < tokens.length; i += 3) {
                let box = tokens[i + 1] as number[];
                let region: Layout.RegionData = {
                    id: tokens[i] as number,
                    box: {x: box[0], y: box[1], w: box[2], h: box[3], v: box[4]},
                    region: tokens[i + 2] as string
                };
                regionData.push(region);
            }
            return { time, event, data: regionData };
        case Data.Event.Discover:
        case Data.Event.Mutation:
            let lastType = null;
            let node = [];
            let tagIndex = 0;
            let domData: DomData[] = [];
            for (let i = 2; i < tokens.length; i++) {
                let token = tokens[i];
                let type = typeof(token);
                switch (type) {
                    case "number":
                        if (type !== lastType && lastType !== null) {
                            domData.push(process(node, tagIndex));
                            node = [];
                            tagIndex = 0;
                        }
                        node.push(token);
                        tagIndex++;
                        break;
                    case "string":
                        node.push(token);
                        break;
                    case "object":
                        let subtoken = token[0];
                        let subtype = typeof(subtoken);
                        switch (subtype) {
                            case "number":
                                for (let t of (token as number[])) {
                                    node.push(tokens.length > t ? tokens[t] : null);
                                }
                                break;
                        }
                }
                lastType = type;
            }
            // Process last node
            domData.push(process(node, tagIndex));

            return { time, event, data: domData };
    }
    return null;
}

function process(node: any[] | number[], tagIndex: number): DomData {
    let [tag, position]: string[]  = node[tagIndex] ? node[tagIndex].split("~") : [node[tagIndex]];
    let output: DomData = {
        id: node[0],
        parent: tagIndex > 1 ? node[1] : null,
        previous: tagIndex > 2 ? node[2] : null,
        tag,
        position: position ? parseInt(position, 10) : null,
        selector: null,
        hash: null
    };
    let hasAttribute = false;
    let attributes: Layout.Attributes = {};
    let value = null;
    let prefix = output.parent in hashes ? `${hashes[output.parent]}>` : (output.parent ? Layout.Constant.Empty : null);

    for (let i = tagIndex + 1; i < node.length; i++) {
        let token = node[i] as string;
        let keyIndex = token.indexOf("=");
        let lastChar = token[token.length - 1];
        if (i === (node.length - 1) && output.tag === "STYLE") {
            value = token;
        } else if (lastChar === ">" && keyIndex === -1) {
            prefix = token;
        } else if (output.tag !== Layout.Constant.TextTag && keyIndex > 0) {
            hasAttribute = true;
            let k = token.substr(0, keyIndex);
            let v = token.substr(keyIndex + 1);
            switch (k) {
                case "src":
                    v = v.length === 0 && output.tag === "IMG" ? placeholderImage : v;
                    break;
                default:
                    break;
            }
            attributes[k] = v;
        } else if (output.tag === Layout.Constant.TextTag) {
            value = token;
        }
    }

    let selector = helper.selector(output.tag, prefix, attributes, output.position);
    if (selector.length > 0) {
        output.selector = selector;
        output.hash = helper.hash(selector);
        hashes[output.id] = selector;
    }

    if (hasAttribute) { output.attributes = attributes; }
    if (value) { output.value = value; }

    return output;
}
