import { Data } from "clarity-js";
import { Constant, DataEvent } from "../types/data";

export function decode(tokens: Data.Token[]): DataEvent {
    let time = tokens[0] as number;
    let event = tokens[1] as Data.Event;
    switch (event) {
        case Data.Event.Ping:
            let ping: Data.PingData = { gap: tokens[2] as number };
            return { time, event, data: ping };
        case Data.Event.Limit:
            let limit: Data.LimitData = { check: tokens[2] as number };
            return { time, event, data: limit };
        case Data.Event.Custom:
            let custom: Data.CustomData = { key: tokens[2] as string, value: tokens[3] as string };
            return { time, event, data: custom };
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
        case Data.Event.Summary:
            let s = 2; // Start from 3rd index since first two are used for time & event
            let summary: Data.SummaryData = {};
            while (s < tokens.length) {
                let key = tokens[s++] as number;
                let values = tokens[s++] as number[];
                summary[key] = [];
                for (let i = 0; i < values.length - 1; i += 2) {
                    summary[key].push([values[i], values[i + 1]]);
                }
            }
            return { time, event, data: summary };
        case Data.Event.Baseline:
            const tokenLength = tokens.length;
            let baselineData: Data.BaselineData = {
                visible: tokens[2] as number,
                docWidth: tokens[3] as number,
                docHeight: tokens[4] as number,
                screenWidth: tokens[5] as number,
                screenHeight: tokens[6] as number,
                scrollX: tokens[7] as number,
                scrollY: tokens[8] as number,
                pointerX: tokens[9] as number,
                pointerY: tokens[10] as number,
                activityTime: tokens[11] as number,
                scrollTime: tokenLength > 12 ? tokens[12] as number: null,
                pointerTime: tokenLength > 13 ? tokens[13] as number: null,
                moveX: tokenLength > 14 ? tokens[14] as number: null,
                moveY: tokenLength > 15 ? tokens[15] as number: null,
                moveTime: tokenLength > 16 ? tokens[16] as number: null,
                downX: tokenLength > 17 ? tokens[17] as number: null, 
                downY: tokenLength > 18 ? tokens[18] as number: null,
                downTime: tokenLength > 19 ? tokens[19] as number: null,
                upX: tokenLength > 20 ? tokens[20] as number: null,
                upY: tokenLength > 21 ? tokens[21] as number: null,
                upTime: tokenLength > 22 ? tokens[22] as number: null,
                pointerPrevX: tokenLength > 23 ? tokens[23] as number: null,
                pointerPrevY: tokenLength > 24 ? tokens[24] as number: null,
                pointerPrevTime: tokenLength > 25 ? tokens[25] as number: null,
                modules: tokenLength > 26 ? tokens[26] as number[]: null,
            }
            return { time, event, data: baselineData };
        case Data.Event.Variable:
            let v = 2; // Start from 3rd index since first two are used for time & event
            let variables: Data.VariableData = {};
            while (v < tokens.length) {
                variables[tokens[v++] as string] = typeof tokens[v + 1] == Constant.String ? [tokens[v++] as string] : tokens[v++] as string[];
            }
            return { time, event, data: variables };
        case Data.Event.Extract:
            let e = 2; // Start from 3rd index since first two are used for time & event
            let extract: Data.ExtractData = {};
            while (e < tokens.length) {
                // For backward compatibility from version 0.7.4
                if (typeof(tokens[e + 1]) == Constant.String) {
                    extract[tokens[e++] as string | number] = tokens[e++] as string;
                }
                else {
                    let key = tokens[e++] as number;
                    let values = tokens[e++] as (number | string)[];
                    extract[key] = [];
                    for (let i = 0; i < values.length - 1; i += 2) {
                        extract[key][values[i] as number] = values[i + 1] as string;
                    }
                }
            }
            return { time, event, data: extract };
        case Data.Event.Consent:
            let consent: Data.ConsentData = { source: tokens[2] as number, ad_Storage: tokens[3] as number, analytics_Storage: tokens[4] as number};
            return { time, event, data: consent };
    }
    return null;
}

export function envelope(tokens: Data.Token[]): Data.Envelope {
    return {
        version: tokens[0] as string,
        sequence: tokens[1] as number,
        start: tokens[2] as number,
        duration: tokens[3] as number,
        projectId: tokens[4] as string,
        userId: tokens[5] as string,
        sessionId: tokens[6] as string,
        pageNum: tokens[7] as number,
        upload: tokens[8] as Data.Upload,
        end: tokens[9] as Data.BooleanFlag,
        applicationPlatform: tokens[10] as number,
        url: tokens[11] as string
    };
}
