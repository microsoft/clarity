import { Diagnostic } from "clarity-js";
import { PartialEvent } from "./core";

export interface ImageErrorEvent extends PartialEvent { data: Diagnostic.ImageErrorData; }
export interface ScriptErrorEvent extends PartialEvent { data: Diagnostic.ScriptErrorData; }
export interface InternalErrorEvent extends PartialEvent { data: Diagnostic.InternalErrorData; }
export interface DiagnosticEvent extends PartialEvent {
    data: Diagnostic.ImageErrorData | Diagnostic.InternalErrorData | Diagnostic.ScriptErrorData;
}
