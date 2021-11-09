import { Time } from "@clarity-types/core";
export type Target = (number | Node);
export type Token = (string | number | number[] | string[]);
export type DecodedToken = (any | any[]);

export type MetadataCallback = (data: Metadata, playback: boolean) => void;

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
/**
 * @deprecated No longer support Network Connection
 */
    Connection = 30,
    ScriptError = 31,
/**
 * @deprecated No longer support Image Error
 */
    ImageError = 32,
    Log = 33,
    Variable = 34,
    Limit = 35,
    Summary = 36,
    Box = 37,
    Clipboard = 38,
    Submit = 39
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
    ProductPrice = 13,
    ScreenWidth = 14,
    ScreenHeight = 15,
    ColorDepth = 16,
    ReviewCount = 17,
    BestRating = 18,
    WorstRating = 19,
    CartPrice = 20,
    CartShipping = 21,
    CartDiscount = 22,
    CartTax = 23,
    CartTotal = 24,
    EventCount = 25,
    Automation = 26,
    Mobile = 27
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
    AuthorName = 8,
    Language = 9,
    ProductName = 10,
    ProductCategory = 11,
    ProductSku = 12,
    ProductCurrency = 13,
    ProductCondition = 14,
    TabId = 15,
    PageLanguage = 16,
    DocumentDirection = 17,
    Headline = 18,
    MetaType = 19,
    MetaTitle = 20,
    Generator = 21,
    Platform = 22,
    PlatformVersion = 23,
    Brand = 24,
    Model = 25
}

export const enum Check {
    None = 0,
    Payload = 1,
    Shutdown = 2,
    Retry = 3,
    Bytes = 4,
    Collection = 5,
    Server = 6
}

export const enum Code {
    RunTask = 0,
    CssRules = 1,
    MutationObserver = 2,
    PerformanceObserver = 3,
    CallStackDepth = 4,
    Selector = 5,
    Metric = 6,
    ContentSecurityPolicy = 7
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
    SessionExpire = 1, // 1 Day
    CookieVersion = 1, // Increment this version every time there's a cookie schema change
    SessionTimeout = 30 * Time.Minute, // 30 minutes
    CookieInterval = 1, // 1 Day
    PingInterval = 1 * Time.Minute, // 1 Minute
    PingTimeout = 5 * Time.Minute, // 5 Minutes
    SummaryInterval = 100, // Same events within 100ms will be collapsed into single summary
    ClickText = 25, // Maximum number of characters to send as part of Click event's text field
    PayloadLimit = 128, // Do not allow more than specified payloads per page
    ShutdownLimit = 2 * Time.Hour, // Shutdown instrumentation after specified time
    RetryLimit = 1, // Maximum number of attempts to upload a payload before giving up
    PlaybackBytesLimit = 10 * 1024 * 1024, // 10MB
    CollectionLimit = 128, // Number of unique entries for dimensions
    ClickPrecision = 32767, // 2^15 - 1
    BoxPrecision = 100, // Up to 2 decimal points (e.g. 34.56)
    ResizeObserverThreshold = 15, // At least 15 characters before we attach a resize observer for the node
    ScriptErrorLimit = 5, // Do not send the same script error more than 5 times per page
    DimensionLimit = 256, // Do not extract dimensions which are over 256 characters
    WordLength = 5, // Estimated average size of a word,
    RestartDelay = 250, // Wait for 250ms before starting to wire up again
    CallStackDepth = 20, // Maximum call stack depth before bailing out
    RatingScale = 100, // Scale rating to specified scale
    ViewportIntersectionRatio = 0.05, // Ratio of intersection area in comparison to viewport area before it's marked visible
    IntersectionRatio = 0.8, // Ratio of intersection area in comparison to element's area before it's marked visible
    MaxFirstPayloadBytes = 1 * 1024 * 1024, // 1MB: Cap the very first payload to a maximum of 1MB
    UploadFactor = 3, // Slow down sequence by specified factor
    MinUploadDelay = 100, // Minimum time before we are ready to flush events to the server
    MaxUploadDelay = 30 * Time.Second // Do flush out payload once every 30s
}

export const enum Character {
    Zero = 48,
    Nine = 57,
    At = 64,
    Blank = 32,
    Tab = 9,
    NewLine = 10,
    Return = 13
}

export const enum Constant {
    Auto = "Auto",
    Config = "Config",
    Clarity = "clarity",
    Restart = "restart",
    Suspend = "suspend",
    Pause = "pause",
    Resume = "resume",
    Report = "report",
    Empty = "",
    Space = " ",
    Expires = "expires=",
    Domain = "domain=",
    Comma = ",",
    Dot = ".",
    Semicolon = ";",
    Equals = "=",
    Path = ";path=/",
    Target = "target",
    Blank = "_blank",
    Parent = "_parent",
    Top = "_top",
    String = "string",
    Number = "number",
    CookieKey = "_clck", // Clarity Cookie Key
    SessionKey = "_clsk", // Clarity Session Key
    TabKey = "_cltk", // Clarity Tab Key
    Pipe = "|",
    End = "END",
    Upgrade = "UPGRADE",
    UserId = "userId",
    SessionId = "sessionId",
    PageId = "pageId",
    ResizeObserver = "ResizeObserver",
    Mask = "•",
    SessionStorage = "sessionStorage",
    Cookie = "cookie",
    Navigation = "navigation",
    Resource = "resource",
    LongTask = "longtask",
    FID = "first-input",
    CLS = "layout-shift",
    LCP = "largest-contentful-paint",
    HTTPS = "https://",
    CompressionStream = "CompressionStream",
    Accept = "Accept",
    ClarityGzip = "application/x-clarity-gzip",
    Tilde = "~",
}

export const enum XMLReadyState {
    Unsent = 0,
    Opened = 1,
    Headers_Recieved = 2,
    Loading = 3,
    Done = 4
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
    projectId: string;
    userId: string;
    sessionId: string;
    pageNum: number;
}

export interface Session {
    session: string;
    ts: number;
    count: number;
    upgrade: BooleanFlag;
    upload: string;
}

export interface User {
    id: string;
    expiry: number;
    consent: BooleanFlag;
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
    [name: string]: string[];
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

export interface LimitData {
    check: number;
}

export interface SummaryData {
    [event: number]: [number, number][]; // Array of [start, duration] for every event type
}

export interface UpgradeData {
    key: string;
}

export interface UploadData {
    sequence: number;
    attempts: number;
    status: number;
}
