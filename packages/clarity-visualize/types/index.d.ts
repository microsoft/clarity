import { Activity, MergedPayload, Options, PlaybackState, ResizeHandler, ScrollMapInfo } from "./visualize";
import { Data, Diagnostic, Interaction, Layout } from "clarity-decode"

export interface Visualize {
    readonly state: PlaybackState;
    dom: (event: Layout.DomEvent) => Promise<void>;
    html: (decoded: Data.DecodedPayload[], target: Window, hash?: string, time?: number) => Visualize;
    clickmap: (activity?: Activity) => void;
    clearmap: () => void;
    scrollmap: (data?: ScrollMapInfo[], averageFold?: number, addMarkers?: boolean) => void;
    merge: (decoded: Data.DecodedPayload[]) => MergedPayload;
    render: (events: Data.DecodedEvent[]) =>  void;
    setup: (target: Window, options: Options) => Visualize;
    time: () => number;
    get: (hash: string) => HTMLElement;
}

declare const visualize: Visualize;

export { visualize, Data, Diagnostic, Interaction, Layout, MergedPayload, ResizeHandler };

export class Visualizer implements Visualize {
    readonly state: PlaybackState;
    dom: (event: Layout.DomEvent) => Promise<void>;
    html: (decoded: Data.DecodedPayload[], target: Window, hash?: string, time?: number) => Visualizer;
    clickmap: (activity?: Activity) => void;
    clearmap: () => void;
    scrollmap: (data?: ScrollMapInfo[], averageFold?: number, addMarkers?: boolean) => void;
    merge: (decoded: Data.DecodedPayload[]) => MergedPayload;
    render: (events: Data.DecodedEvent[]) =>  void;
    setup: (target: Window, options: Options) => Visualizer;
    time: () => number;
    get: (hash: string) => HTMLElement;
}
