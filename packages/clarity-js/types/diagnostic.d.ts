import { Code, Target } from "./data";

/* Event Data */
export interface ScriptErrorData {
    source: string;
    message: string;
    line: number;
    column: number;
    stack: string;
}

export interface ImageErrorData {
    source: string;
    target: Target;
}

export interface InternalErrorData {
    code: Code;
    name: string;
    message: string;
}
