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

export interface ConnectionData {
    downlink: number;
    rtt: number;
    saveData: BooleanFlag;
    type: string;
}
