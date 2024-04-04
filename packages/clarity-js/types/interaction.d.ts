import { Time } from "./core";
import { Event, Target } from "./data";

/* Enum */

export const enum BrowsingContext {
    Self = 0,
    Blank = 1,
    Parent = 2,
    Top = 3
}

export const enum Setting {
    LookAhead = 500, // 500ms
    InputLookAhead = 1000, // 1s
    Distance = 20, // 20 pixels
    Interval = 25, // 25 milliseconds
    TimelineSpan = 2 * Time.Second, // 2 seconds
}

export const enum Clipboard {
    Cut = 0,
    Copy = 1,
    Paste = 2
}

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

export interface ClipboardState {
    time: number;
    event: number;
    data: ClipboardData;
}

export interface ScrollState {
    time: number;
    event: number;
    data: ScrollData;
}

export interface SubmitState {
    time: number;
    event: number;
    data: SubmitData;
}

export interface ChangeState {
    time: number;
    event: number;
    data: ChangeData;
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
    hash: string;
    x: number;
    y: number;
    reaction: number;
    context: number;
}

export interface ChangeData {
    target: Target;
    type: string;
    value: string;
    checksum: string;
}

export interface InputData {
    target: Target;
    value: string;
}

export interface SubmitData {
    target: Target;
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
    reaction: number;
    context: BrowsingContext;
    text: string;
    link: string;
    hash: string;
    trust: number;
}

export interface ClipboardData {
    target: Target;
    action: Clipboard;
}

export interface ResizeData {
    width: number;
    height: number;
}

export interface ScrollData {
    target: Target;
    x: number;
    y: number;
    top: string;
    bottom: string;
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
