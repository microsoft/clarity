import { Metadata, Payload, Token } from "./data";

type TaskFunction = () => Promise<void>;
type TaskResolve = () => void;
type UploadCallback = (data: string) => void;

/* Enum */

export const enum Priority {
    Normal = 0,
    High = 1
}

export const enum Time {
    Second = 1000,
    Minute = 60 * 1000,
    Hour = 60 * 60 * 1000
}

export const enum Setting {
    LongTask = 30, // 30ms
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

export interface Regions {
    /* In the following key-value pair, key is the given name and value is CSS selector */
    [key: string]: string;
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
    m: string; // Message
    p: string; // Project Id
    u: string; // User Id
    s: string; // Session Id
    n: number; // Page Number
}

export interface Config {
    projectId?: string;
    delay?: number;
    cssRules?: boolean;
    lean?: boolean;
    track?: boolean;
    content?: boolean;
    mask?: string[];
    unmask?: string[];
    regions?: Regions;
    cookies?: string[];
    report?: string;
    upload?: string | UploadCallback;
    upgrade?: (key: string) => void;
}
