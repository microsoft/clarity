import { Code, Constant, Event, Severity } from "@clarity-types/data";
import { LogData } from "@clarity-types/diagnostic";
import config from "@src/core/config";
import { bind } from "@src/core/event";
import encode from "./encode";

let history: { [key: number]: string[] } = {};
export let data: LogData;

export function start(): void {
    history = {};
    bind(document, "securitypolicyviolation", csp);
}

export function log(code: Code, severity: Severity, name: string = null, message: string = null, stack: string = null): void {
    let key = name ? `${name}|${message}`: "";
    // While rare, it's possible for code to fail repeatedly during the lifetime of the same page
    // In those cases, we only want to log the failure once and not spam logs with redundant information.
    if (code in history && history[code].indexOf(key) >= 0) { return; }

    data = { code, name, message, stack, severity };

    // Maintain history of errors in memory to avoid sending redundant information
    if (code in history) { history[code].push(key); } else { history[code] = [key]; }

    encode(Event.Log);
}

function csp(e: SecurityPolicyViolationEvent): void {
    let upload = config.upload as string;
    let parts = upload ? upload.substr(0, upload.indexOf("/", Constant.HTTPS.length)).split(Constant.Dot) : []; // Look for first "/" starting after initial "https://" string
    let domain = parts.length >= 2 ? parts.splice(-2).join(Constant.Dot) : null;
    // Capture content security policy violation only if disposition value is not explicitly set to "report"
    if (domain && e.blockedURI && e.blockedURI.indexOf(domain) >= 0 && e["disposition"] !== Constant.Report) {
        log(Code.ContentSecurityPolicy, Severity.Warning, e.blockedURI);
    }
}

export function stop(): void {
    history = {};
}
