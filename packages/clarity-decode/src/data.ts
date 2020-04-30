import { Data } from "clarity-js";
import { DataEvent } from "../types/data";

let summaries: { [key: number]: Data.SummaryData[] } = null;
const SUMMARY_THRESHOLD = 30;

export function reset(): void {
    summaries = {};
}

export function decode(tokens: Data.Token[]): DataEvent {
    let time = tokens[0] as number;
    let event = tokens[1] as Data.Event;
    switch (event) {
        case Data.Event.Page:
            let page: Data.PageData = {
                timestamp: tokens[2] as number,
                ua: tokens[3] as string,
                url: tokens[4] as string,
                referrer: tokens[5] as string,
                lean: tokens[6] as Data.BooleanFlag,
            };
            return { time, event, data: page };
        case Data.Event.Ping:
            let ping: Data.PingData = { gap: tokens[2] as number };
            return { time, event, data: ping };
        case Data.Event.Tag:
            let tag: Data.TagData = { key: tokens[2] as string, value: tokens[3] as string[] };
            return { time, event, data: tag };
        case Data.Event.Target:
            let targetData: Data.TargetData[] = [];
            for (let t = 2; t < tokens.length; t += 4) {
                let target: Data.TargetData = {
                    id: tokens[t] as number,
                    hash: tokens[t + 1] as string,
                    box: tokens[t + 2] as number[],
                    region: tokens[t + 3] as string
                };
                targetData.push(target);
            }
            return { time, event, data: targetData };
        case Data.Event.Upgrade:
            let upgrade: Data.UpgradeData = { key: tokens[2] as string };
            return { time, event, data: upgrade };
        case Data.Event.Upload:
            let upload: Data.UploadData = { sequence: tokens[2] as number, attempts: tokens[3] as number, status: tokens[4] as number };
            return { time, event, data: upload };
        case Data.Event.Metric:
            let i = 2; // Start from 3rd index since first two are used for time & event
            let metrics: Data.MetricData = {};
            while (i < tokens.length) {
                metrics[tokens[i++] as number] = tokens[i++] as number;
            }
            return { time, event, data: metrics };
    }
    return null;
}

export function envelope(tokens: Data.Token[]): Data.Envelope {
    return {
        sequence: tokens[0] as number,
        version: tokens[1] as string,
        projectId: tokens[2] as string,
        userId: tokens[3] as string,
        sessionId: tokens[4] as string,
        pageId: tokens[5] as string,
        upload: tokens[6] as Data.Upload,
        end: tokens[7] as Data.BooleanFlag
    };
}

export function summarize(entry: Data.Token[]): void {
    let time = entry[0] as number;
    let type = entry[1] as Data.Event;
    let data: Data.SummaryData = { event: type, start: time, end: time };
    if (!(type in summaries)) { summaries[type] = [data]; }

    let s = summaries[type][summaries[type].length - 1];
    if (time - s.end < SUMMARY_THRESHOLD) { s.end = time; } else { summaries[type].push(data); }
}

export function summary(): DataEvent[] {
    let data: Data.SummaryData[] = [];
    let time = null;
    for (let type in summaries) {
        if (summaries[type]) {
            for (let d of summaries[type]) {
                time = time ? Math.min(time, d.start) : d.start;
                data.push(d);
            }
        }
    }
    return data.length > 0 ? [{ time, event: Data.Event.Summary, data }] : null;
}
