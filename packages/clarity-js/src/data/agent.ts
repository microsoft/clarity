import { AgenticBrowserSignal, Dimension } from "@clarity-types/data";
import * as task from "@src/core/task";
import * as dimension from "@src/data/dimension";

// Muse-like evidence: reduced Linux user agent, ARM client hint and SwiftShader rendering.
// Metadata checks ARM before calling collectMuseEnvironment; this module checks Linux and SwiftShader.
// https://arcjet.com/learn/how-to-detect-metas-muse-ai-agent
const LinuxX64Token = "linux x86_64)";
const SwiftShaderPattern = /swiftshader/i;
let active = false;
let generation = 0;

export function start(): void {
    active = navigator.userAgent.toLowerCase().indexOf(LinuxX64Token) >= 0;
}

export function stop(): void {
    active = false;
    generation++;
}

export function collectMuseEnvironment(): void {
    if (!active) { return; }
    const current = generation;
    task.scheduleIdle((): void => {
        if (!active || current !== generation) { return; }
        if (SwiftShaderPattern.test(readRenderer())) { logSignal(AgenticBrowserSignal.MuseEnvironmentMatched); }
    });
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
