import { BooleanFlag, Target } from "./data";

/* Helper Interface */


// Reference: https://wicg.github.io/netinfo/#networkinformation-interface
export interface NavigatorConnection extends EventTarget {
    effectiveType: string;
    downlinkMax: number;
    downlink: number;
    rtt: number;
    saveData: boolean;
}

/* Event Data */
export interface NavigationData {
    fetchStart: number;
    connectStart: number;
    connectEnd: number;
    requestStart: number;
    responseStart: number;
    responseEnd: number;
    domInteractive: number;
    domComplete: number;
    loadEventStart: number;
    loadEventEnd: number;
    redirectCount: number;
    size: number;
    type: string;
    protocol: string;
    encodedSize: number;
    decodedSize: number;
}

export const enum FunctionNames {
    HistoryCompute = 1,
    Restart = 2,
    DiagnosticStart = 3,
    ScriptHandler = 4,
    ChangeRecompute = 5,
    ClickHandler = 6,
    ClipboardRecompute = 7,
    InteractionStart = 8,
    InputRecompute = 9,
    PointerMouse = 10,
    PointerTouch = 11,
    ResizeRecompute = 12,
    ScrollRecompute = 13,
    ScrollCompute = 14,
    SelectionRecompute = 15,
    SubmitRecompute = 16,
    UnloadRecompute = 17,
    VisibilityRecompute = 18,
    DocumentCompute = 19,
    LayoutStart = 20,
    MutationStart = 21,
    MutationHandle = 22,
    MutationGenerate = 23,
    RegionCompute = 24,
    PerformanceStart = 25,
    ObserverObserve = 26,
    ObserverHandle = 27
}

declare global { interface Function { dn?: FunctionNames; } }