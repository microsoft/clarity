import { Time } from "@clarity-types/core";
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
    Baseline = 4,
    Discover = 5,
    Mutation = 6,
    Region = 7,
    Document = 8,
    Click = 9,
    Scroll = 10,
    Resize = 11,
    MouseMove = 12,
    MouseDown = 13,
    MouseUp = 14,
    MouseWheel = 15,
    DoubleClick = 16,
    TouchStart = 17,
    TouchEnd = 18,
    TouchMove = 19,
    TouchCancel = 20,
    Selection = 21,
    Timeline = 22,
    Page = 23,
    Custom = 24,
    Ping = 25,
    Unload = 26,
    Input = 27,
    Visibility = 28,
    Navigation = 29,
    Connection = 30,
    ScriptError = 31,
    ImageError = 32,
    Log = 33,
    Variable = 34
}

export const enum Metric {
    ClientTimestamp = 0,
    Playback = 1,
    TotalBytes = 2,
    LayoutCost = 3,
    TotalCost = 4,
    InvokeCount = 5,
    ThreadBlockedTime = 6,
    LongTaskCount = 7,
    LargestPaint = 8,
    CumulativeLayoutShift = 9,
    FirstInputDelay = 10,
    RatingValue = 11,
    RatingCount = 12,
    ProductPrice = 13
}

export const enum Dimension {
    UserAgent = 0,
    Url = 1,
    Referrer = 2,
    PageTitle = 3,
    NetworkHosts = 4,
    SchemaType = 5,
    ProductBrand = 6,
    ProductAvailability = 7,
    AuthorName = 8
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

export const enum Setting {
    Expire = 365, // 1 Year
    SessionTimeout = 30 * Time.Minute, // 10 minutes
    PingInterval = 1 * Time.Minute, // 1 Minute
    PingTimeout = 5 * Time.Minute, // 5 Minutes
    PayloadLimit = 128, // Do not allow more than specified payloads per page
    ShutdownLimit = 2 * Time.Hour, // Shutdown instrumentation after specified time
}

export const enum Constant {
    AUTO = "Auto",
    CLARITY = "clarity",
    RESTART = "restart",
    SUSPEND = "suspend",
    PAUSE = "pause",
    RESUME = "resume",
    EMPTY_STRING = "",
    SPACE = " ",
    EXPIRES = "expires=",
    SEMICOLON = ";",
    EQUALS = "=",
    PATH = ";path=/",
    STRING_TYPE = "string",
    UPGRADE_KEY = "_club", // Clarity Upgrade Beta
    CLARITY_COOKIE = "_clcb", // Clarity Cookie Beta
    STORAGE_KEY = "_clsb", // Clarity Storage Beta
    STORAGE_SEPARATOR = "|",
    RESPONSE_END = "END",
    RESPONSE_UPGRADE = "UPGRADE",
    RESERVED_USER_ID_VARIABLE = "userId",
    RESERVED_SESSION_ID_VARIABLE = "sessionId",
    RESERVED_PAGE_ID_VARIABLE = "pageId"
}

/* Helper Interfaces */

export interface Payload {
    e: Token[]; /* Envelope */
    a: Token[][]; /* Events that are used for data analysis */
    p: Token[][]; /* Events that are primarily used for session playback */
}

export interface EncodedPayload {
    e: string; /* Envelope */
    a: string; /* Analytics Payload */
    p: string; /* Playback Payload */
}

export interface Metadata {
    projectId: number;
    userId: number;
    sessionId: number;
    pageNum: number;
}

export interface TargetMetadata {
    id: number;
    region: number;
    hash: number;
    node: Node;
}

export interface Envelope extends Metadata {
    sequence: number;
    start: number;
    duration: number;
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

export interface BaselineState {
    time: number;
    event: number;
    data: BaselineData;
}

/* Event Data */
export interface BaselineData {
    visible: BooleanFlag;
    docWidth: number;
    docHeight: number;
    screenWidth: number;
    screenHeight: number;
    scrollX: number;
    scrollY: number;
    pointerX: number;
    pointerY: number;
    activityTime: number;
}

export interface DimensionData {
    [key: number]: string[];
}

export interface VariableData {
    [name: string]: string;
}

// Eventually custom event can be expanded to contain more properties 
// For now, restricting to key value pair where both key & value are strings
// The way it's different from variable is that Custom Event has a notion of time
// Whereas variables have no timing element and eventually will turn into custom dimensions
export interface CustomData {
    key: string;
    value: string;
}

export interface MetricData {
    [key: number]: number;
}

export interface PingData {
    gap: number;
}

export interface UpgradeData {
    key: string;
}

export interface UploadData {
    sequence: number;
    attempts: number;
    status: number;
}