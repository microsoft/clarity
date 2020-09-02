import { Constant, Event, VariableData } from "@clarity-types/data";
import * as core from "@src/core";
import encode from "./encode";

export let data: VariableData = null;

export function start(): void {
    reset();
}

export function set(variable: string, value: string): void {
    log(variable, value);
}

export function identify(userId: string, sessionId: string = null, pageId: string = null): void {
    log(Constant.UserId, userId);
    log(Constant.SessionId, sessionId);
    log(Constant.PageId, pageId);
}

function log(variable: string, value: string): void {
    if (core.active() &&
        variable &&
        value &&
        typeof variable === Constant.String &&
        typeof value === Constant.String &&
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

export function stop(): void {
    reset();
}
