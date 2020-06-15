import { BooleanFlag, Event, Target } from "./data";

/* Helper Interfaces */
export interface PointerState {
    time: number;
    event: number;
    data: PointerData;
}

export interface ClickState {
    time: number;
    event: number;
    data: ClickData;
}

export interface ScrollState {
    time: number;
    event: number;
    data: ScrollData;
}

export interface InputState {
    time: number;
    event: number;
    data: InputData;
}

export interface TimelineState {
    time: number;
    event: number;
    data: TimelineData;
}

/* Event Data */
export interface TimelineData {
    type: Event;
    target: number;
    x: number;
    y: number;
    hash?: number;
    region?: number
}

export interface InputData {
    target: Target;
    value: string;
    region?: number;
}

export interface PointerData {
    target: Target;
    x: number;
    y: number;
}

export interface ClickData {
    target: Target;
    x: number;
    y: number;
    eX: number;
    eY: number;
    button: number;
    text: string;
    link: string;
    hash: number;
    region?: number;
}

export interface ResizeData {
    width: number;
    height: number;
}

export interface ScrollData {
    target: Target;
    x: number;
    y: number;
    region?: number;
}

export interface SelectionData {
    start: Target;
    startOffset: number;
    end: Target;
    endOffset: number;
}

export interface UnloadData {
    name: string;
}

export interface VisibilityData {
    visible: string;
}
