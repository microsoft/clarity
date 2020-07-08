import { Data, Diagnostic } from "clarity-js";
import { DiagnosticEvent } from "@clarity-types/diagnostic";

export function decode(tokens: Data.Token[]): DiagnosticEvent {
    let time = tokens[0] as number;
    let event = tokens[1] as Data.Event;
    switch (event) {
        case Data.Event.ImageError:
            let imageError: Diagnostic.ImageErrorData = {
                source: tokens[2] as string,
                target: tokens[3] as number
            };
            return { time, event, data: imageError };
        case Data.Event.ScriptError:
            let scriptError: Diagnostic.ScriptErrorData = {
                message: tokens[2] as string,
                line: tokens[3] as number,
                column: tokens[4] as number,
                stack: tokens[5] as string,
                source: tokens[6] as string
            };
            return { time, event, data: scriptError };
        case Data.Event.InternalError:
            let internalError: Diagnostic.InternalErrorData = {
                code: tokens[2] as number,
                name: tokens[3] as string,
                message: tokens[4] as string,
                stack: tokens[5] as string,
                severity: tokens[6] as number
            };
            return { time, event, data: internalError };
    }
    return null;
}
