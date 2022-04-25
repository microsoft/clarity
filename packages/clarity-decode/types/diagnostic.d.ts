import { Diagnostic } from "clarity-js";
import { PartialEvent } from "./core";

export interface ScriptErrorEvent extends PartialEvent { data: Diagnostic.ScriptErrorData; }
export interface LogEvent extends PartialEvent { data: Diagnostic.LogData; }
export interface FraudEvent extends PartialEvent { data: Diagnostic.FraudData; }

export interface DiagnosticEvent extends PartialEvent {
    data: Diagnostic.FraudData | Diagnostic.LogData | Diagnostic.ScriptErrorData;
}
