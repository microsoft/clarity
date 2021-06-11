import { Activity, MergedPayload, ResizeHandler, ScrollMapInfo } from "./visualize";
import { Data, Diagnostic, Interaction, Layout } from "clarity-decode"

export interface Visualize {
    dom: (event: Layout.DomEvent) => Promise<void>;
    html: (decoded: Data.DecodedPayload[], target: Window, hash?: string, time?: number) => Visualize;
    clickmap: (activity?: Activity) => void;
    clearmap: () => void;
    scrollmap: (data?: ScrollMapInfo[], averageFold?: number) => void;
    merge: (decoded: Data.DecodedPayload[]) => MergedPayload;
    render: (events: Data.DecodedEvent[]) =>  void;
    reset: () => void;
    setup: (version: string, target: Window, onresize?: ResizeHandler, metadata?: HTMLElement) => Visualize;
    time: () => number;
}

declare const visualize: Visualize;

export { visualize, Data, Diagnostic, Interaction, Layout, MergedPayload, ResizeHandler };
