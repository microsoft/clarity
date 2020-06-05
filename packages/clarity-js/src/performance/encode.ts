import {Event, Token} from "@clarity-types/data";
import { time } from "@src/core/time";
import tokenize from "@src/data/token";
import { queue } from "@src/data/upload";
import { getMatch } from "@src/layout/dom";
import * as connection from "@src/performance/connection";
import * as navigation from "@src/performance/navigation";
import * as network from "@src/performance/network";
import * as target from "@src/layout/target";

export default async function(type: Event): Promise<void> {
    let t = time();
    let tokens: Token[] = [t, type];
    switch (type) {
        case Event.Connection:
            tokens.push(connection.data.downlink);
            tokens.push(connection.data.rtt);
            tokens.push(connection.data.saveData);
            tokens.push(connection.data.type);
            connection.reset();
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
                    let data = state.data;
                    let networkTarget = target.metadata(getMatch(state.url));
                    data.target = networkTarget.id;
                    data.region = networkTarget.region;
                    let metadata = [];
                    let keys = ["start", "duration", "size", "target", "initiator", "protocol", "host"];
                    for (let key of keys) {
                        switch (key) {
                            case "target":
                                if (data[key]) {
                                    tokens.push(data["target"] as number);
                                    tokens.push(data["region"]);
                                }
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
    }
}
