import { Constant, Event, IdentityData, Setting, VariableData } from "@clarity-types/data";
import * as core from "@src/core";
import { scrub } from "@src/core/scrub";
import encode from "./encode";

export let data: VariableData = null;

export function start(): void {
    reset();
}

export function set(variable: string, value: string | string[]): void {
    let values = typeof value === Constant.String ? [value as string] : value as string[];
    log(variable, values);
}

export async function identify(userId: string, sessionId: string = null, pageId: string = null, userHint: string = null): Promise<IdentityData> {
    let output: IdentityData = { userId: await sha256(userId), userHint: userHint || redact(userId) };

    // By default, hash custom userId using SHA256 algorithm on the client to preserve privacy
    log(Constant.UserId, [output.userId]);
    
    // Optional non-identifying name for the user
    // If name is not explicitly provided, we automatically generate a redacted version of the userId
    log(Constant.UserHint, [output.userHint]);
    log(Constant.UserType, [detect(userId)]);    

    // Log sessionId and pageId if provided
    if (sessionId) { 
        log(Constant.SessionId, [sessionId]);
        output.sessionId = sessionId;
    }
    if (pageId) {
        log(Constant.PageId, [pageId]);
        output.pageId = pageId;
    }

    return output;
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

function redact(input: string): string {
    return input.length >= Setting.WordLength ? 
        `${input.substring(0,2)}${scrub(input.substring(2), Constant.Asterix, Constant.Asterix)}` : scrub(input, Constant.Asterix, Constant.Asterix);
}

async function sha256(input: string): Promise<string> {
    try {
        if (crypto) {
            // Reference: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest#converting_a_digest_to_a_hex_string
            const buffer = await crypto.subtle.digest(Constant.SHA256, new (TextEncoder as any)(Constant.UTF8).encode(input));
            return Array.prototype.map.call(new Uint8Array(buffer), (x: any) =>(('00'+x.toString(16)).slice(-2))).join('');
        } else { return Constant.Empty; }
    } catch { return Constant.Empty; }
}

function detect(input: string): string {
    return input && input.indexOf(Constant.At) > 0 ? Constant.Email : Constant.String;
}