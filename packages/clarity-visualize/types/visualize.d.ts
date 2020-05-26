import { Data, Layout } from "clarity-decode";


export type ResizeHandler  = (width: number, height: number) => void;

export interface MergedPayload {
    timestamp: number;
    envelope: Data.Envelope;
    dom: Layout.DomEvent;
    events: Data.DecodedEvent[];
}

export interface Point {
    time: number;
    x: number;
    y: number;
}

export interface PlaybackState {
    version: string;
    player: HTMLIFrameElement;
    metadata: HTMLElement;
    onresize: ResizeHandler;
}
