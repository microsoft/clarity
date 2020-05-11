import { Data } from "clarity-decode";

type ResizeHandler  = (width: number, height: number) => void;

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
