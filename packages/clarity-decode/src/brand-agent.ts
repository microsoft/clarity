import { Data } from "clarity-js";
import { BrandAgentEvent } from "../types/brand-agent";

export function decode(tokens: Data.Token[]): BrandAgentEvent {
    let time = tokens[0] as number;
    let event = tokens[1] as Data.Event;
    let data = {
        name: tokens[2] as string,
        msg: tokens[3] as string,
        cid: tokens[4] as string,
    };
    return { time, event, data };
}
