import { Data } from "clarity-js";
import { DataEvent } from "../types/data";

export function decode(tokens: Data.Token[]): DataEvent {
    let time = tokens[0] as number;
    let event = tokens[1] as Data.Event;
    switch (event) {
        case Data.Event.Ping:
            let ping: Data.PingData = { gap: tokens[2] as number };
            return { time, event, data: ping };
        case Data.Event.Tag:
            let tag: Data.TagData = { key: tokens[2] as string, value: tokens[3] as string[] };
            return { time, event, data: tag };
        case Data.Event.Upgrade:
            let upgrade: Data.UpgradeData = { key: tokens[2] as string };
            return { time, event, data: upgrade };
        case Data.Event.Upload:
            let upload: Data.UploadData = { sequence: tokens[2] as number, attempts: tokens[3] as number, status: tokens[4] as number };
            return { time, event, data: upload };
        case Data.Event.Metric:
            let m = 2; // Start from 3rd index since first two are used for time & event
            let metrics: Data.MetricData = {};
            while (m < tokens.length) {
                metrics[tokens[m++] as number] = tokens[m++] as number;
            }
            return { time, event, data: metrics };
        case Data.Event.Dimension:
            let d = 2; // Start from 3rd index since first two are used for time & event
            let dimensions: Data.DimensionData = {};
            while (d < tokens.length) {
                dimensions[tokens[d++] as number] = tokens[d++] as string[];
            }
            return { time, event, data: dimensions };
    }
    return null;
}

export function envelope(tokens: Data.Token[]): Data.Envelope {
    return {
        version: tokens[0] as string,
        sequence: tokens[1] as number,
        projectId: tokens[2] as number,
        userId: tokens[3] as number,
        sessionId: tokens[4] as number,
        pageId: tokens[5] as number,
        upload: tokens[6] as Data.Upload,
        end: tokens[7] as Data.BooleanFlag
    };
}
