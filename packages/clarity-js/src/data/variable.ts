import { Constant, Event, VariableData } from "@clarity-types/data";
import encode from "./encode";

export let data: VariableData = null;

export function set(variable: string, value: string): void {
    log(variable, value);
}

export function identify(userId: string, sessionId: string = null, pageId: string = null): void {
    log(Constant.RESERVED_USER_ID_VARIABLE, userId);
    log(Constant.RESERVED_SESSION_ID_VARIABLE, sessionId);
    log(Constant.RESERVED_PAGE_ID_VARIABLE, pageId);
}

function log(variable: string, value: string): void {
    if (variable &&
        value &&
        typeof variable === Constant.STRING_TYPE &&
        typeof value === Constant.STRING_TYPE &&
        variable.length < 255 &&
        value.length < 255) {
        data[variable] = value;
    }
}

export function compute(): void {
    encode(Event.Variable);
}

export function reset(): void {
    data = {};
}
