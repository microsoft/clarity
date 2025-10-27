import { Time } from "@clarity-types/core";
export type Target = (number | Node);
export type Token = (string | number | number[] | string[] | (string | number)[]);
export type DecodedToken = (any | any[]);

export type MetadataCallback = (data: Metadata, playback: boolean, consentStatus?: ConsentState) => void;
export interface MetadataCallbackOptions {
    callback: MetadataCallback,
    wait: boolean,
    recall: boolean,
    called: boolean,
    consentInfo: boolean
}
export type SignalCallback = (data: ClaritySignal) => void

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
    /**
     * @deprecated No longer support Box event
     */
    Box = 37,
    Clipboard = 38,
    Submit = 39,
    Extract = 40,
    Fraud = 41,
    Change = 42,
    Snapshot = 43,
    Animation = 44,
    StyleSheetAdoption = 45,
    StyleSheetUpdate = 46,
    Consent = 47,
    ContextMenu = 48,
    // 49 is reserved for internal use
    Focus = 50,
    CustomElement = 51,
    Chat = 52,

    // Apps specific events
    WebViewDiscover = 100,
    WebViewMutation = 101,
    MutationError = 102,
    FragmentVisibility = 103,
    Keystrokes = 104,
    BackGesture = 105,
    WebViewStatus = 106,
    AppInstallReferrer = 107
    // 200-300 reserved for internal use
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
    Mobile = 27,
    UploadTime = 28,
    SinglePage = 29,
    /**
     * @deprecated Browser API is deprecated. Reference: https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory
     */
    UsedMemory = 30,
    Iframed = 31,
    MaxTouchPoints = 32,
    HardwareConcurrency = 33,
    DeviceMemory = 34,
    Electron = 35,
    /**
     * @deprecated No longer tracking
     */
    ConstructedStyles = 36,
    /**
     * @deprecated Move it to dimension as it'll report only last value
     */
    InteractionNextPaint = 37,
    HistoryClear = 38,
    AngularZone = 39,
    // 200-300 reserved for internal use
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
    Model = 25,
    DevicePixelRatio = 26,
    ConnectionType = 27,
    Dob = 28,
    CookieVersion = 29,
    DeviceFamily = 30, // Allows iOS SDK to override the DeviceFamily value parsed from UserAgent.
    InitialScrollTop = 31,
    InitialScrollBottom = 32,
    AncestorOrigins = 33,
    Timezone = 34,
    TimezoneOffset = 35,
    Consent = 36,
    InteractionNextPaint = 37
    // 200-300 reserved for internal use
}

export const enum Check {
    None = 0,
    Payload = 1,
    Shutdown = 2,
    Retry = 3,
    Bytes = 4,
    Collection = 5,
    Server = 6,
    Page = 7
}

export const enum Code {
    RunTask = 0,
    CssRules = 1,
    MutationObserver = 2,
    PerformanceObserver = 3,
    CallStackDepth = 4,
    Selector = 5,
    Metric = 6,
    /**
     * @deprecated No longer support ContentSecurityPolicy
     */
    ContentSecurityPolicy = 7,
    Config = 8,
    FunctionExecutionTime = 9,
    LeanLimit = 10,
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

export const enum GCMConsent {
    Unknown = 0,
    Granted = 1,
    Denied = 2
}

export const enum IframeStatus {
    Unknown = 0,
    TopFrame = 1,
    Iframe = 2
}

export const enum Setting {
    Expire = 365, // 1 Year
    SessionExpire = 1, // 1 Day
    CookieVersion = 2, // Increment this version every time there's a cookie schema change
    SessionTimeout = 30 * Time.Minute, // 30 minutes
    CookieInterval = 1, // 1 Day
    PingInterval = 1 * Time.Minute, // 1 Minute
    PingTimeout = 5 * Time.Minute, // 5 Minutes
    SummaryInterval = 100, // Same events within 100ms will be collapsed into single summary
    ClickText = 25, // Maximum number of characters to send as part of Click event's text field
    PayloadLimit = 128, // Do not allow more than specified payloads per page
    PageLimit = 128, // Do not allow more than 128 pages in a session
    ShutdownLimit = 2 * Time.Hour, // Shutdown instrumentation after specified time
    RetryLimit = 1, // Maximum number of attempts to upload a payload before giving up
    PlaybackBytesLimit = 10 * 1024 * 1024, // 10MB
    CollectionLimit = 128, // Number of unique entries for dimensions
    ClickPrecision = 32767, // 2^15 - 1
    BoxPrecision = 100, // Up to 2 decimal points (e.g. 34.56)
    ScriptErrorLimit = 5, // Do not send the same script error more than 5 times per page
    DimensionLimit = 256, // Do not extract dimensions which are over 256 characters
    WordLength = 5, // Estimated average size of a word,
    RestartDelay = 250, // Wait for 250ms before starting to wire up again
    CallStackDepth = 20, // Maximum call stack depth before bailing out
    RatingScale = 100, // Scale rating to specified scale
    ViewportIntersectionRatio = 0.05, // Ratio of intersection area in comparison to viewport area before it's marked visible
    IntersectionRatio = 0.8, // Ratio of intersection area in comparison to element's area before it's marked visible
    MaxFirstPayloadBytes = 1 * 1024 * 1024, // 1MB: Cap the very first payload to a maximum of 1MB
    MegaByte = 1024 * 1024, // 1MB
    UploadFactor = 3, // Slow down sequence by specified factor
    MinUploadDelay = 100, // Minimum time before we are ready to flush events to the server
    MaxUploadDelay = 30 * Time.Second, // Do flush out payload once every 30s,
    ExtractLimit = 10000, // Do not extract more than 10000 characters
    ChecksumPrecision = 28, // n-bit integer to represent token hash
    UploadTimeout = 15000, // Timeout in ms for XHR requests
    LongTask = 30, // Long Task threshold in ms
    MaxBeaconPayloadBytes = 64 * 1024, // 64KB: Cap the beacon payload to a maximum of 64KB
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

export const enum ApplicationPlatform {
    WebApp = 0
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
    Memory = "memory",
    Empty = "",
    Space = " ",
    Expires = "expires=",
    Domain = "domain=",
    Dropped = "*na*",
    Comma = ",",
    Dot = ".",
    At = "@",
    Asterix = "*",
    Semicolon = ";",
    Equals = "=",
    Path = ";path=/",
    Target = "target",
    Blank = "_blank",
    Parent = "_parent",
    Top = "_top",
    String = "string",
    Number = "number",
    Email = "email",
    CookieKey = "_clck", // Clarity Cookie Key
    SessionKey = "_clsk", // Clarity Session Key
    TabKey = "_cltk", // Clarity Tab Key
    Pipe = "|",
    End = "END",
    Upgrade = "UPGRADE",
    Action = "ACTION",
    Signal = "SIGNAL",
    Extract = "EXTRACT",
    Snapshot = "SNAPSHOT",
    Module = "MODULE",
    UserHint = "userHint",
    UserType = "userType",
    UserId = "userId",
    SessionId = "sessionId",
    PageId = "pageId",
    Mask = "•", // Placeholder character for explicitly masked content
    Digit = "▫", // Placeholder character for digits
    Letter = "▪", // Placeholder character for letters
    SessionStorage = "sessionStorage",
    Cookie = "cookie",
    Navigation = "navigation",
    Resource = "resource",
    LongTask = "longtask",
    FID = "first-input",
    CLS = "layout-shift",
    LCP = "largest-contentful-paint",
    PerformanceEventTiming = "event",
    HTTPS = "https://",
    CompressionStream = "CompressionStream",
    Accept = "Accept",
    ClarityGzip = "application/x-clarity-gzip",
    Tilde = "~",
    ArrayStart = "[",
    ConditionStart = "{",
    ConditionEnd = "}",
    Seperator = "<SEP>",
    Timeout = "Timeout",
    Bang = "!",
    SHA256 = "SHA-256",
    Electron = "Electron",
    Caret = "^",
    Granted = "granted",
    Denied = "denied",
    AdStorage = "ad_storage",
    AnalyticsStorage = "analytics_storage",
}

export const enum XMLReadyState {
    Unsent = 0,
    Opened = 1,
    Headers_Recieved = 2,
    Loading = 3,
    Done = 4
}

export const enum ConsentSource {
    Implicit = 0,
    API = 1,
    GCM = 2
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
    version: number;
    expiry: number;
    consent: BooleanFlag;
    dob: number;
}

export interface Envelope extends Metadata {
    sequence: number;
    start: number;
    duration: number;
    version: string;
    upload: Upload;
    end: BooleanFlag;
    applicationPlatform: number;
    url: string;
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
    scrollTime: number;
    pointerTime?: number;
    moveX?: number;
    moveY?: number;
    moveTime?: number;
    downX?: number;
    downY?: number;
    downTime?: number;
    upX?: number;
    upY?: number;
    upTime?: number;
    pointerPrevX?: number;
    pointerPrevY?: number;
    pointerPrevTime?: number;
    modules: number[];
}

export interface IdentityData {
    userId: string;
    userHint: string;
    sessionId?: string;
    pageId?: string;
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
    key?: string;
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

export interface ExtractData {
    [key: number]: { [subkey: number]: string }; // Array of { subkey: number } representing the extracted data
}

export interface UploadData {
    sequence: number;
    attempts: number;
    status: number;
}

export interface ClaritySignal {
    type: string
    value?: number
}

export interface PerformanceEventTiming extends PerformanceEntry {
    duration: DOMHighResTimeStamp;
    interactionId: number;
}

export interface Interaction {
    id: number;
    latency: number;
}

export interface ConsentState {
    ad_Storage?: string;
    analytics_Storage?: string;
}

export const enum ConsentType {
    None = 0,
    Implicit = 1,
    General = 2
}

export interface ConsentData {
    source: ConsentSource;
    ad_Storage: BooleanFlag;
    analytics_Storage: BooleanFlag;
}

export interface GCMConsentState {
    ad_Storage: GCMConsent;
    analytics_Storage: GCMConsent;
}
