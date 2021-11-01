import { Data, Performance } from "clarity-js";
import { PerformanceEvent } from "../types/performance";

export function decode(tokens: Data.Token[]): PerformanceEvent  {
    let time = tokens[0] as number;
    let event = tokens[1] as Data.Event;
    switch (event) {
        case Data.Event.Navigation:
            let navigationData: Performance.NavigationData = {
                fetchStart: tokens[2] as number,
                connectStart: tokens[3] as number,
                connectEnd: tokens[4] as number,
                requestStart: tokens[5] as number,
                responseStart: tokens[6] as number,
                responseEnd: tokens[7] as number,
                domInteractive: tokens[8] as number,
                domComplete: tokens[9] as number,
                loadEventStart: tokens[10] as number,
                loadEventEnd: tokens[11] as number,
                redirectCount: tokens[12] as number,
                size: tokens[13] as number,
                type: tokens[14] as string,
                protocol: tokens[15] as string,
                encodedSize: tokens[16] as number,
                decodedSize: tokens[17] as number
            };
            return { time, event, data: navigationData };
    }
    return null;
}
