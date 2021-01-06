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

function log(variable: string, value: string | string[]): void {
    if (core.active() &&
        variable &&
        value &&
        typeof variable === Constant.String &&
        variable.length < 255) {
        if (typeof value === Constant.String && value.length < 255) { data[variable] = value }
        else if (Array.isArray(value)) {
            let validValues = []
            for (let i = 0; i < value.length; i++) {
                if (typeof value[i] === Constant.String && value[i].length < 255) { validValues.push(value[i]); }
            }
            data[variable] = validValues;
        }
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
