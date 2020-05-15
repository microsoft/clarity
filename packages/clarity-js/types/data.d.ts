export type Target = (number | TargetInfo);
export type Token = (string | number | number[] | string[]);
export type DecodedToken = (any | any[]);

/* Enum */

export const enum Event {
    Metric = 0,
    Discover = 1,
    Mutation = 2,
    BoxModel = 3,
    Hash = 4,
    Resize = 5,
    Document = 6,
    Scroll = 7,
    Click = 8,
    MouseMove = 9,
    MouseDown = 10,
    MouseUp = 11,
    MouseWheel = 12,
    DoubleClick = 13,
    RightClick = 14, /* Deprecated */
    TouchStart = 15,
    TouchEnd = 16,
    TouchMove = 17,
    TouchCancel = 18,
    Selection = 19,
    Page = 20,
    Tag = 21,
    Ping = 22,
    Unload = 23,
    Input = 24,
    Visibility = 25,
    Network = 26,
    Navigation = 27,
    ScriptError = 28,
    ImageError = 29,
    Resource = 30,
    Summary = 31,
    Upload = 32,
    Target = 33,
    LongTask = 34,
    Paint = 35,
    ContentfulPaint = 36,
    Memory = 37,
    Connection = 38,
    Upgrade = 39,
    InternalError = 40
}

export const enum Metric {
    TotalBytes = 0,
    LayoutBytes = 1,
    InteractionBytes = 2,
    PerformanceBytes = 3,
    TargetBytes = 4,
    InvokeCount = 5,
    LongTaskCount = 6,
    TotalDuration = 7,
    DiscoverDuration = 8,
    MutationDuration = 9,
    BoxModelDuration = 10,
    MaxThreadBlockedDuration = 11,
    DataDuration = 12,
    DiagnosticDuration = 13,
    InteractionDuration = 14,
    PerformanceDuration = 15,
    RegionBytes = 16
}

export const enum Code {
    RunTask = 0,
    CssRules = 1,
    MutationObserver = 2,
    PerformanceObserver = 3
}

export const enum Severity {
    Info = 0,
    Warning = 1,
    Error = 2,
    Fatal = 3
}

export const enum Upload {
    Async = 0,
    Beacon = 1
}

export const enum BooleanFlag {
    False = 0,
    True = 1
}

/* Helper Interfaces */

export interface Payload {
    e: Token[];
    d: Token[][];
}

export interface EncodedPayload {
    e: string;
    d: string;
}

export interface ClarityInfo {
    userId: string;
    sessionId: string;
    pageId: string;
}

export interface TargetInfo {
    id: number;
    selector: string;
    region: string;
    node: Node;
}

export interface Metadata {
    page: PageData;
    envelope: Envelope;
}

export interface Envelope {
    sequence: number;
    version: string;
    projectId: string;
    userId: string;
    sessionId: string;
    pageId: string;
    upload: Upload;
    end: BooleanFlag;
}

export interface Transit {
    [key: number]: {
        data: string;
        attempts: number;
    };
}

/* Event Data */

export interface MetricData {
    [key: number]: number;
}

export interface PageData {
    timestamp: number;
    ua: string;
    url: string;
    referrer: string;
    lean: BooleanFlag;
}

export interface PingData {
    gap: number;
}

export interface TagData {
    key: string;
    value: string[];
}

export interface UpgradeData {
    key: string;
}

export interface TargetData {
    id: number;
    hash: string;
    region: string;
    box: number[];
}

export interface UploadData {
    sequence: number;
    attempts: number;
    status: number;
}

export interface SummaryData {
    event: Event;
    start: number;
    end: number;
}
