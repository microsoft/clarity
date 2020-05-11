import { ClarityInfo, Payload, Token } from "./data";

type TaskFunction = () => Promise<void>;
type TaskResolve = () => void;

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

/* Helper Interfaces */

export interface TaskTracker {
    [key: number]: TaskInfo;
}

export interface RegionTracker {
    /* In the following key-value pair, key is the given name and value is CSS selector */
    [key: string]: string;
}

export interface TaskInfo {
    start: number;
    calls: number;
    yield: number;
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

export interface Config {
    projectId?: string;
    longtask?: number;
    lookahead?: number;
    distance?: number;
    interval?: number;
    delay?: number;
    expire?: number;
    ping?: number;
    timeout?: number;
    session?: number;
    shutdown?: number;
    cssRules?: boolean;
    lean?: boolean;
    track?: boolean;
    regions?: RegionTracker;
    url?: string;
    onstart?: (data: ClarityInfo) => void;
    upload?: (data: string, sequence?: number, last?: boolean) => void;
}
