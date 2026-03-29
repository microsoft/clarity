import {Event, Token} from "@clarity-types/data";
import { time } from "@src/core/time";
import { queue } from "@src/data/upload";
import * as navigation from "@src/performance/navigation";

export default async function(type: Event): Promise<void> {
    let t = time();
    let tokens: Token[] = [t, type];
    switch (type) {
        case Event.Navigation:
            tokens.push(
                navigation.data.fetchStart, navigation.data.connectStart,
                navigation.data.connectEnd, navigation.data.requestStart,
                navigation.data.responseStart, navigation.data.responseEnd,
                navigation.data.domInteractive, navigation.data.domComplete,
                navigation.data.loadEventStart, navigation.data.loadEventEnd,
                navigation.data.redirectCount, navigation.data.size,
                navigation.data.type, navigation.data.protocol,
                navigation.data.encodedSize, navigation.data.decodedSize
            );
            navigation.reset();
            queue(tokens);
            break;
    }
}
