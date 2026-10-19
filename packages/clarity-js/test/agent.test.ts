import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Browser environment evidence tests for Meta Muse detection.
 * Muse claims Intel Linux ("Linux x86_64") but reports an ARM architecture and a SwiftShader (software) WebGL renderer.
 * The tag only reports evidence on the agentic dimension (39): "8" for ARM and "9" for SwiftShader.
 * The backend decides the verdict. These tests stub the environment and verify the reported evidence.
 */

const clarityJsPath = join(__dirname, "../build/clarity.min.js");
const AgenticDimension = 39;
const DimensionEvent = 1;
const ArmSignal = "8";
const SwiftShaderSignal = "9";

const MuseUserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const WindowsUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const RaspberryPiUserAgent = "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const WindowsArmUserAgent = "Mozilla/5.0 (Windows NT 10.0; ARM64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const FirefoxLinuxUserAgent = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0";
const MacUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const SwiftShaderRenderer = "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)";
const GpuRenderer = "ANGLE (Broadcom, V3D 7.1, OpenGL ES 3.1)";
const AppleRenderer = "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)";

interface Environment {
    userAgent: string;
    // undefined removes navigator.userAgentData (Firefox/Safari); "throw" makes getHighEntropyValues reject.
    architecture?: string;
    // null makes getContext("webgl") return null; "throw" makes it throw.
    renderer: string | null;
}

interface Probe {
    architectureCalls: number;
    webglCalls: number;
    loseContextCalls: number;
}

interface Result {
    signals: string[];
    probe: Probe;
    // Probe snapshot taken synchronously after clarity("start"), before the browser goes idle.
    probeAtStart: Probe;
}

function stubEnvironment(env: Environment): void {
    const probe = { architectureCalls: 0, webglCalls: 0, loseContextCalls: 0 };
    (window as any).__probe = probe;
    Object.defineProperty(Navigator.prototype, "userAgent", { get: () => env.userAgent, configurable: true });
    const uaData = env.architecture === undefined ? undefined : {
        brands: [{ brand: "Chromium", version: "154" }],
        mobile: false,
        platform: "Linux",
        getHighEntropyValues: (hints: string[]): Promise<any> => {
            if (hints.indexOf("architecture") >= 0) {
                probe.architectureCalls++;
                if (env.architecture === "throw") { return Promise.reject(new Error("blocked")); }
            }
            return Promise.resolve({ architecture: env.architecture, platform: "Linux", brands: [], mobile: false });
        }
    };
    Object.defineProperty(Navigator.prototype, "userAgentData", { get: () => uaData, configurable: true });

    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: any[]): any {
        if (type !== "webgl") { return original.apply(this, [type, ...args]); }
        probe.webglCalls++;
        if (env.renderer === "throw") { throw new Error("blocked"); }
        if (env.renderer === null) { return null; }
        const debugInfo = { UNMASKED_RENDERER_WEBGL: 0x9246 };
        const loseContext = { loseContext: (): void => { probe.loseContextCalls++; } };
        return {
            getExtension: (name: string): any =>
                name === "WEBGL_debug_renderer_info" ? debugInfo : name === "WEBGL_lose_context" ? loseContext : null,
            getParameter: (key: number): any => key === debugInfo.UNMASKED_RENDERER_WEBGL ? env.renderer : null
        };
    } as any;
}

async function run(page: any, env: Environment): Promise<Result> {
    await page.addInitScript(stubEnvironment, env);
    await page.goto("data:text/html,<!DOCTYPE html><html><head></head><body><div>hi</div></body></html>");
    await page.evaluate((code: string) => { eval(code); }, readFileSync(clarityJsPath, "utf-8"));
    return page.evaluate(({ dimension, event }: { dimension: number; event: number }) => {
        return new Promise<Result>((resolve) => {
            const payloads: string[] = [];
            (window as any).clarity("start", { projectId: "test", track: false, upload: (payload: string) => { payloads.push(payload); } });
            const probeAtStart = { ...(window as any).__probe };
            setTimeout(() => {
                (window as any).clarity("stop");
                const signals: string[] = [];
                for (const payload of payloads) {
                    const parsed = JSON.parse(payload);
                    for (const entry of [...(parsed.a || []), ...(parsed.p || [])]) {
                        if (entry[1] !== event) { continue; }
                        for (let i = 2; i < entry.length; i += 2) {
                            if (entry[i] === dimension) { signals.push(...entry[i + 1]); }
                        }
                    }
                }
                resolve({ signals: signals.sort(), probe: { ...(window as any).__probe }, probeAtStart });
            }, 2000);
        });
    }, { dimension: AgenticDimension, event: DimensionEvent });
}

test.describe("agent - Meta Muse evidence", () => {
    test("Muse profile (Linux x86_64 + arm + SwiftShader) reports both signals", async ({ page }) => {
        const result = await run(page, { userAgent: MuseUserAgent, architecture: "arm", renderer: SwiftShaderRenderer });
        expect(result.signals).toEqual([ArmSignal, SwiftShaderSignal]);
    });

    test("Muse profile with arm64 reports both signals", async ({ page }) => {
        const result = await run(page, { userAgent: MuseUserAgent, architecture: "arm64", renderer: SwiftShaderRenderer });
        expect(result.signals).toEqual([ArmSignal, SwiftShaderSignal]);
    });

    test("user agent match is case-insensitive", async ({ page }) => {
        const result = await run(page, { userAgent: MuseUserAgent.toUpperCase(), architecture: "arm", renderer: SwiftShaderRenderer });
        expect(result.signals).toEqual([ArmSignal, SwiftShaderSignal]);
    });

    test("headless Linux x86 with SwiftShader reports only SwiftShader", async ({ page }) => {
        const result = await run(page, { userAgent: MuseUserAgent, architecture: "x86", renderer: SwiftShaderRenderer });
        expect(result.signals).toEqual([SwiftShaderSignal]);
    });

    test("Linux without client hints is unknown architecture, not evidence", async ({ page }) => {
        const result = await run(page, { userAgent: MuseUserAgent, renderer: SwiftShaderRenderer });
        expect(result.signals).toEqual([SwiftShaderSignal]);
        expect(result.probe.architectureCalls).toBe(0);
    });

    test("ARM Linux with a real GPU reports only ARM", async ({ page }) => {
        const result = await run(page, { userAgent: MuseUserAgent, architecture: "arm", renderer: GpuRenderer });
        expect(result.signals).toEqual([ArmSignal]);
    });

    const gated: [string, Environment][] = [
        ["Windows Chrome", { userAgent: WindowsUserAgent, architecture: "x86", renderer: GpuRenderer }],
        ["Raspberry Pi (Linux aarch64) with a real GPU", { userAgent: RaspberryPiUserAgent, architecture: "arm", renderer: GpuRenderer }],
        ["Windows on ARM with SwiftShader", { userAgent: WindowsArmUserAgent, architecture: "arm", renderer: SwiftShaderRenderer }],
        ["Firefox on Linux", { userAgent: FirefoxLinuxUserAgent, renderer: SwiftShaderRenderer }],
        ["Mac on Apple silicon", { userAgent: MacUserAgent, architecture: "arm", renderer: AppleRenderer }]
    ];
    for (const [name, env] of gated) {
        test(`${name} is gated before any client-hint or WebGL call`, async ({ page }) => {
            const result = await run(page, env);
            expect(result.signals).toEqual([]);
            expect(result.probe).toEqual({ architectureCalls: 0, webglCalls: 0, loseContextCalls: 0 });
        });
    }

    test("runs at idle, not during start", async ({ page }) => {
        const result = await run(page, { userAgent: MuseUserAgent, architecture: "arm", renderer: SwiftShaderRenderer });
        expect(result.probeAtStart).toEqual({ architectureCalls: 0, webglCalls: 0, loseContextCalls: 0 });
        expect(result.probe.webglCalls).toBe(1);
    });

    test("releases the WebGL context", async ({ page }) => {
        const result = await run(page, { userAgent: MuseUserAgent, architecture: "arm", renderer: SwiftShaderRenderer });
        expect(result.probe.loseContextCalls).toBe(1);
    });

    test("survives WebGL and client-hint failures", async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error: Error) => errors.push(error.message));
        const result = await run(page, { userAgent: MuseUserAgent, architecture: "throw", renderer: "throw" });
        expect(result.signals).toEqual([]);
        expect(errors).toEqual([]);
    });

    test("survives a missing WebGL context", async ({ page }) => {
        const result = await run(page, { userAgent: MuseUserAgent, architecture: "arm", renderer: null });
        expect(result.signals).toEqual([ArmSignal]);
    });
});
