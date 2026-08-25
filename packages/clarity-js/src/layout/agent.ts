import { AgenticBrowserSignal, Dimension } from "@clarity-types/data";
import * as dimension from "@src/data/dimension";

const roots = [
    "claude-agent-glow-border",
    "claude-agent-stop-container",
    "claude-phantom-cursor",
    "codex-agent-overlay-root"
];

export function discover(): void {
    for (let id of roots) {
        let element = document.getElementById(id);
        if (element) { root(element, element.parentNode); }
    }
}

export function mutation(record: MutationRecord): void {
    let target = record.target;
    if (record.type === "childList" && (target === document.body || target === document.documentElement)) {
        for (let i = 0; i < record.addedNodes.length; i++) {
            let node = record.addedNodes[i];
            if (node.nodeType === Node.ELEMENT_NODE) { root(node as Element, target); }
        }
    } else if (record.type === "attributes" && record.attributeName === "id" &&
        (target.parentNode === document.body || target.parentNode === document.documentElement ||
        !target.parentNode && (target as Element).ownerDocument === document)) {
        root(target as Element, target.parentNode);
    }
}

function root(element: Element, parent: Node): void {
    let id = element.id;
    let signal = id === roots[0] ? AgenticBrowserSignal.ClaudeAgentGlowBorder :
        id === roots[1] ? AgenticBrowserSignal.ClaudeAgentStopContainer :
        id === roots[2] ? AgenticBrowserSignal.ClaudePhantomCursor :
        id === roots[3] ? AgenticBrowserSignal.CodexAgentOverlayRoot : AgenticBrowserSignal.None;
    let valid = signal === AgenticBrowserSignal.CodexAgentOverlayRoot ?
        parent === document.documentElement || !parent : parent === document.body || !parent;
    if (signal && valid) {
        log(signal);
        let child = element.firstElementChild;
        if (signal === AgenticBrowserSignal.ClaudeAgentGlowBorder && child && child.id === "claude-agent-glow-border-inner") {
            log(AgenticBrowserSignal.ClaudeAgentGlowBorderInner);
        } else if (signal === AgenticBrowserSignal.ClaudeAgentStopContainer && child && child.id === "claude-agent-stop-button") {
            log(AgenticBrowserSignal.ClaudeAgentStopButton);
        }
    }
}

function log(signal: AgenticBrowserSignal): void {
    dimension.log(Dimension.AgenticBrowserSignal, signal.toString());
}
