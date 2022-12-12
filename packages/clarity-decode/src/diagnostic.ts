import { Data, Diagnostic } from "clarity-js";
import { DiagnosticEvent } from "../types/diagnostic";

export function decode(tokens: Data.Token[]): DiagnosticEvent {
    let time = tokens[0] as number;
    let event = tokens[1] as Data.Event;
    switch (event) {
        case Data.Event.ScriptError:
            let scriptError: Diagnostic.ScriptErrorData = {
                message: tokens[2] as string,
                line: tokens[3] as number,
                column: tokens[4] as number,
                stack: tokens[5] as string,
                source: tokens[6] as string
            };
            return { time, event, data: scriptError };
        case Data.Event.Log:
            let log: Diagnostic.LogData = {
                code: tokens[2] as number,
                name: tokens[3] as string,
                message: tokens[4] as string,
                stack: tokens[5] as string,
                severity: tokens[6] as number
            };
            return { time, event, data: log };
        case Data.Event.Fraud:
            let fraud: Diagnostic.FraudData = {
                id: tokens[2] as number,
                target: tokens[3] as number,
                checksum: tokens[4] as string
            };
            return { time, event, data: fraud };
    }
    return null;
}
