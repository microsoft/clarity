import * as Data from "./data";

type TaskFunction = () => Promise<void>;
type TaskResolve = () => void;
type UploadCallback = (data: string) => void;
type Region = [number /* RegionId */, string /* Query Selector */, RegionFilter? /* Region Filter */, string? /* Filter Text */];
type Metric = [Data.Metric /* MetricId */, Extract /* Extract Filter */, string /* Match Value */, number? /* Scale Factor */];
type Dimension = [Data.Dimension /* DimensionId */, Extract /* Extract Filter */, string /* Match Value */];

/* Enum */

export const enum Priority {
    Normal = 0,
    High = 1
}

export const enum Time {
    Second = 1000,
    Minute = 60 * 1000,
    Hour = 60 * 60 * 1000,
    Day = 24 * 60 * 60 * 1000
}


export const enum Task {
    Wait = 0,
    Run = 1,
    Stop = 2
}

export const enum Setting {
    LongTask = 30, // 30ms
}

export const enum RegionFilter {
    Url = 0,
    Javascript = 1
}

export const enum Extract {
    Text = 0,
    Javascript = 1,
    Attribute = 2
}

export const enum Privacy {
    None = 0,
    Sensitive = 1,
    Text = 2,
    TextImage = 3,
    Exclude = 4
}

/* Helper Interfaces */

export interface Module {
    start: () => void;
    stop: () => void;
}

export interface Tasks {
    [key: number]: TaskInfo;
}

export interface TaskInfo {
    start: number;
    calls: number;
    yield: number;
}

export interface Timer {
    id: string;
    cost: Data.Metric;
}

export interface RequestIdleCallbackOptions {
    timeout: number;
}

export interface RequestIdleCallbackDeadline {
    didTimeout: boolean;
    timeRemaining: (() => number);
}

export interface AsyncTask {
    task: TaskFunction;
    resolve: TaskResolve;
    id: string;
}

export interface OffsetDistance {
    x: number;
    y: number;
}

export interface BrowserEvent {
    event: string;
    target: EventTarget;
    listener: EventListener;
    capture: boolean;
}

export interface Report {
    v: string; // Version
    p: string; // Project Id
    u: string; // User Id
    s: string; // Session Id
    n: number; // Page Number
    m?: string; // Message, optional
    e?: string; // Error Stack, optional
}

export interface Config {
    projectId?: string;
    delay?: number;
    lean?: boolean;
    track?: boolean;
    content?: boolean;
    mask?: string[];
    unmask?: string[];
    regions?: Region[];
    metrics?: Metric[];
    dimensions?: Dimension[];
    cookies?: string[];
    report?: string;
    upload?: string | UploadCallback;
    fallback?: string;
    upgrade?: (key: string) => void;
}
