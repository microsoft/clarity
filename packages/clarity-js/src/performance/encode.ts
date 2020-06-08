import {Event, Token} from "@clarity-types/data";
import { time } from "@src/core/time";
import { queue } from "@src/data/upload";
import * as connection from "@src/performance/connection";
import * as navigation from "@src/performance/navigation";

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
    }
}
