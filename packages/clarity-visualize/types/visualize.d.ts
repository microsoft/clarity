import { Data } from "clarity-decode";

type ResizeHandler  = (width: number, height: number) => void;

interface Container {
    player: HTMLIFrameElement;
    metrics?: HTMLDivElement;
}

export interface Point {
    time: number;
    x: number;
    y: number;
}

export interface PlaybackState {
    version: string;
    player: HTMLIFrameElement;
    metrics: HTMLDivElement;
    onresize: ResizeHandler;
}
