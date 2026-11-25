import { AgenticBrowserSignal, Event } from "@clarity-types/data";
import { time } from "@src/core/time";
import * as upload from "@src/data/upload";

const ClaudeGlowBorder = "claude-agent-glow-border";
const ClaudePhantomCursor = "claude-phantom-cursor";
const CodexOverlayRoot = "codex-agent-overlay-root";
let detected: AgenticBrowserSignal[] = [];

export function start(): void {
    detected = [];
}

export function stop(): void {
    detected = [];
}

export function detect(id: string, parent: Node): void {
    let signal = identify(id, parent);
    if (signal !== AgenticBrowserSignal.None && !detected.includes(signal)) {
        detected.push(signal);
        upload.queue([time(), Event.AgenticBrowser, signal], false);
    }
}

function identify(id: string, parent: Node): AgenticBrowserSignal {
    if (parent === document.body) {
        switch (id) {
            case ClaudeGlowBorder:
                return AgenticBrowserSignal.ClaudeAgentGlowBorder;
            case ClaudePhantomCursor:
                return AgenticBrowserSignal.ClaudePhantomCursor;
        }
    } else if (parent === document.documentElement) {
        switch (id) {
            case CodexOverlayRoot:
                return AgenticBrowserSignal.CodexAgentOverlayRoot;
        }
    }

    return AgenticBrowserSignal.None;
}
