import { Constant } from "@clarity-types/data";
import { Data, Layout } from "clarity-js";
import { DomData, LayoutEvent, Interaction, RegionVisibility  } from "../types/layout";

const AverageWordLength = 6;
const Space = " ";

export function decode(tokens: Data.Token[]): LayoutEvent {
    let time = tokens[0] as number;
    let event = tokens[1] as Data.Event;

    switch (event) {
        case Data.Event.Document:
            let documentData: Layout.DocumentData = { width: tokens[2] as number, height: tokens[3] as number };
            return { time, event, data: documentData };
        case Data.Event.Region:
            let regionData: Layout.RegionData[] = [];
            // From 0.6.15 we send each reach update in an individual event. This allows us to include time with it.
            // To keep it backward compatible (<= 0.6.14), we look for multiple regions in the same event. This works both with newer and older payloads.
            // In future, we can update the logic to look deterministically for only 3 fields and remove the for loop.
            let increment: number;
            for (let i = 2; i < tokens.length; i += increment) {
                let region: Layout.RegionData;
                if (typeof(tokens[i+2]) == Constant.Number) {
                    region = {
                        id: tokens[i] as number,
                        interaction: tokens[i + 1] as number,
                        visibility: tokens[i + 2] as number,
                        name: tokens[i + 3] as string
                    };
                    increment = 4;
                } else {
                    let state = tokens[i + 1] as number;
                    region = {
                        id: tokens[i] as number,
                        // For backward compatibility before 0.6.24 - where region states were sent as a single enum 
                        // we convert the value into the two states tracked after 0.6.24
                        interaction:  state >= Interaction.None ? state : Interaction.None,
                        visibility: state <= RegionVisibility.ScrolledToEnd ? state : RegionVisibility.Rendered,
                        name: tokens[i + 2] as string
                    };
                    increment = 3;
                }
                regionData.push(region);
            }
            return { time, event, data: regionData };
        case Data.Event.Box:
            let boxData: Layout.BoxData[] = [];
            for (let i = 2; i < tokens.length; i += 3) {
                let box: Layout.BoxData = {
                    id: tokens[i] as number,
                    width: tokens[i + 1] as number / Data.Setting.BoxPrecision,
                    height: tokens[i + 2] as number / Data.Setting.BoxPrecision
                };
                boxData.push(box);
            }
            return { time, event, data: boxData };
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
    // For backward compatibility, only extract the tag even if position is available as part of the tag name
    // And, continue computing position in the visualization library from decoded payload.
    let tag  = node[tagIndex] ? node[tagIndex].split("~")[0] : node[tagIndex];
    let output: DomData = {
        id: Math.abs(node[0]),
        parent: tagIndex > 1 ? node[1] : null,
        previous: tagIndex > 2 ? node[2] : null,
        tag
    };
    let masked = node[0] < 0;
    let hasAttribute = false;
    let attributes: Layout.Attributes = {};
    let value = null;

    for (let i = tagIndex + 1; i < node.length; i++) {
        // Explicitly convert the token into a string value
        let token = node[i].toString();
        let keyIndex = token.indexOf("=");
        let firstChar = token[0];
        let lastChar = token[token.length - 1];
        if (i === (node.length - 1) && output.tag === "STYLE") {
            value = token;
        } else if (output.tag !== Layout.Constant.TextTag && lastChar === ">" && keyIndex === -1) {
            // Backward compatibility - since v0.6.25
            // Ignore this conditional block since we no longer compute selectors at decode time to save on uploaded bytes
            // Instead, we now compute selector and hash at visualization layer where we have access to all payloads together
        } else if (output.tag !== Layout.Constant.TextTag && firstChar === Layout.Constant.Box && keyIndex === -1) {
            let parts = token.substr(1).split(Layout.Constant.Period);
            if (parts.length === 2) {
                output.width = num(parts[0]) / Data.Setting.BoxPrecision;
                output.height = num(parts[1]) / Data.Setting.BoxPrecision;
            }
        } else if (output.tag !== Layout.Constant.TextTag && keyIndex > 0) {
            hasAttribute = true;
            let k = token.substr(0, keyIndex);
            let v = token.substr(keyIndex + 1);
            attributes[k] = v;
        } else if (output.tag === Layout.Constant.TextTag) {
            value = masked ? unmask(token) : token;
        }
    }

    if (hasAttribute) { output.attributes = attributes; }
    if (value) { output.value = value; }

    return output;
}

function num(input: string): number {
    return input ? parseInt(input, 36) : null;
}

function unmask(value: string): string {
    let trimmed = value.trim();
    if (trimmed.length > 0 && trimmed.indexOf(Space) === -1) {
        let length = num(trimmed);
        if (length > 0) {
            let quotient = Math.floor(length / AverageWordLength);
            let remainder = length % AverageWordLength;
            let output = Array(remainder + 1).join(Data.Constant.Mask);
            for (let i = 0; i < quotient; i++) {
                output += (i === 0 && remainder === 0 ? Data.Constant.Mask : Space) + Array(AverageWordLength).join(Data.Constant.Mask);
            }
            return output;
        }
    }
    return value;
}
