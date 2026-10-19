import { AgenticBrowserSignal, Dimension } from "@clarity-types/data";
import * as task from "@src/core/task";
import * as dimension from "@src/data/dimension";

// Meta Muse sends no identity: it claims Intel Linux but runs on ARM hardware without a GPU.
// Report browser-API agent evidence; layout/agent.ts handles DOM evidence.
// https://arcjet.com/learn/how-to-detect-metas-muse-ai-agent
const LinuxX64Token = "linux x86_64)";
const SwiftShaderPattern = /swiftshader/i;
let active = false;

export function start(): void {
    // Gate before any client-hint or WebGL call so normal visitors pay nothing.
    active = navigator.userAgent.toLowerCase().indexOf(LinuxX64Token) >= 0;
    if (active) { task.idle(detect); }
}

export function stop(): void {
    active = false;
}

function detect(): void {
    readArchitecture().then((architecture: string): void => {
        if (!active) { return; }
        if (architecture === "arm" || architecture === "arm64") { logSignal(AgenticBrowserSignal.ArmArchitecture); }
        if (SwiftShaderPattern.test(readRenderer())) { logSignal(AgenticBrowserSignal.SwiftShaderRenderer); }
    });
}

// A missing value (no client hints, e.g. Firefox) is unknown, not evidence.
function readArchitecture(): Promise<string> {
    try {
        let uaData = navigator["userAgentData"];
        if (uaData && uaData.getHighEntropyValues) {
            return uaData.getHighEntropyValues(["architecture"]).then(
                (values: { architecture?: string }): string => values.architecture || "",
                (): string => "");
        }
    } catch (error) { /* Client hints blocked. */ }
    return Promise.resolve("");
}

function readRenderer(): string {
    let gl: WebGLRenderingContext = null;
    try {
        gl = document.createElement("canvas").getContext("webgl");
        let info = gl && gl.getExtension("WEBGL_debug_renderer_info");
        return (info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) || "";
    } catch (error) {
        return "";
    } finally {
        releaseContext(gl);
    }
}

// Browsers cap live WebGL contexts per page, so free ours instead of waiting for garbage collection.
function releaseContext(gl: WebGLRenderingContext): void {
    try {
        let lose = gl && gl.getExtension("WEBGL_lose_context");
        if (lose) { lose.loseContext(); }
    } catch (error) { /* Context already lost or blocked. */ }
}

function logSignal(signal: AgenticBrowserSignal): void {
    dimension.log(Dimension.AgenticBrowserSignal, signal.toString());
}
