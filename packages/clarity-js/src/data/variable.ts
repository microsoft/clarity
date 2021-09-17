import { Constant, Event, VariableData } from "@clarity-types/data";
import * as core from "@src/core";
import encode from "./encode";

export let data: VariableData = null;

export function start(): void {
    reset();
}

export function set(variable: string, value: string | string[]): void {
    let values = typeof value === Constant.String ? [value as string] : value as string[];
    log(variable, values);
}

export function identify(userId: string, sessionId: string = null, pageId: string = null): void {
    log(Constant.UserId, [userId]);
    log(Constant.SessionId, [sessionId]);
    log(Constant.PageId, [pageId]);
}

function log(variable: string, value: string[]): void {
    if (core.active() &&
        variable &&
        value &&
        typeof variable === Constant.String &&
        variable.length < 255) {
        let validValues = variable in data ? data[variable] : [];
        for (let i = 0; i < value.length; i++) {
            if (typeof value[i] === Constant.String && value[i].length < 255) { validValues.push(value[i]); }
        }
        data[variable] = validValues;
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
