import { BooleanFlag, Target } from "./data";

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

export interface BaselineState {
    time: number;
    event: number;
    data: BaselineData;
}

/* Event Data */
export interface InputData {
    target: Target;
    value: string;
    region?: number;
}

export interface PointerData {
    target: Target;
    x: number;
    y: number;
    region?: number;    
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
    region?: number;
}

export interface UnloadData {
    name: string;
}

export interface VisibilityData {
    visible: string;
}

export interface BaselineData {
    visible: BooleanFlag;
    docWidth: number;
    docHeight: number;
    scrollX: number;
    scrollY: number;
    pointerX: number;
    pointerY: number;
}
