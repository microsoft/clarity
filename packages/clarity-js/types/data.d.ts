export type Target = (number | Node);
export type Token = (string | number | number[] | string[]);
export type DecodedToken = (any | any[]);

/* Enum */

export const enum Event {
    /* Data */
    Metric = 0,
    Dimension = 1,
    Upload = 2,
    Upgrade = 3,
    Discover = 4,
    Mutation = 5,
    Region = 6,
    Document = 7,
    Click = 8,
    Scroll = 9,
    Resize = 10,
    MouseMove = 11,
    MouseDown = 12,
    MouseUp = 13,
    MouseWheel = 14,
    DoubleClick = 15,
    TouchStart = 16,
    TouchEnd = 17,
    TouchMove = 18,
    TouchCancel = 19,
    Selection = 20,
    Page = 21,
    Tag = 22,
    Ping = 23,
    Unload = 24,
    Input = 25,
    Visibility = 26,
    Baseline = 27,
    Network = 28,
    Navigation = 29,    
    Connection = 30,
    ScriptError = 31,
    ImageError = 32,
    Log = 33
}

export const enum Metric {
    /* Data */
    ClientTimestamp = 0,
    Playback = 1,

    /* Internal Clarity Metrics */
    TotalBytes = 2,
    LayoutCost = 3,
    TotalCost = 4,
    InvokeCount = 5,
    ThreadBlockTime = 6,
    
    /* Performance */
    LongTaskCount = 7,
    LargestPaint = 8,
    CumulativeLayoutShift = 9,
    FirstInputDelay = 10
}

export const enum Dimension {
    UserAgent,
    Url,
    Referrer,
    PageTitle
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

export interface Metadata {
    projectId: number;
    userId: number;
    sessionId: number;
    pageId: number;
}

export interface TargetMetadata {
    id: number;
    region: number;
    hash: string;
    node: Node;
}

export interface Envelope extends Metadata {
    sequence: number;
    version: string;
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
export interface DimensionData {
    [key: number]: string[];
}

export interface MetricData {
    [key: number]: number;
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

export interface UploadData {
    sequence: number;
    attempts: number;
    status: number;
}