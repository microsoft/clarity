import { AgenticBrowserSignal, Dimension } from "@clarity-types/data";
import * as dimension from "@src/data/dimension";

const ClaudeGlowBorder = "claude-agent-glow-border";
const ClaudePhantomCursor = "claude-phantom-cursor";
const CodexOverlayRoot = "codex-agent-overlay-root";
const CodexSidebarRoot = "codex-browser-sidebar-comments-root";

let seen: Set<AgenticBrowser> = null;

const enum AgenticBrowser {
    None = 0,
    Claude = 1,
    Codex = 2
}

export function start(): void {
    seen = new Set();
}

export function scan(): void {
    detect(find(ClaudeGlowBorder, document.body));
    detect(find(ClaudePhantomCursor, document.body));
    detect(find(CodexOverlayRoot, document.documentElement));
    detect(find(CodexSidebarRoot, document.documentElement));
}

export function detect(node: Node, parent: Node = null): void {
    if (seen.has(AgenticBrowser.Claude) && seen.has(AgenticBrowser.Codex) ||
        !node || node.nodeType !== Node.ELEMENT_NODE) { return; }

    let element = node as HTMLElement;
    let signal = identify(element.id, parent || element.parentElement);
    let browser = classify(signal);
    if (browser !== AgenticBrowser.None && !seen.has(browser)) {
        seen.add(browser);
        dimension.log(Dimension.AgenticBrowserSignal, signal.toString());
    }
}

function find(id: string, parent: HTMLElement): HTMLElement {
    let element = document.getElementById(id);
    if (!element || !parent || element.parentElement === parent) { return element; }

    for (let i = 0; i < parent.children.length; i++) {
        element = parent.children[i] as HTMLElement;
        if (element.id === id) { return element; }
    }

    return null;
}

function classify(signal: AgenticBrowserSignal): AgenticBrowser {
    switch (signal) {
        case AgenticBrowserSignal.ClaudeAgentGlowBorder:
        case AgenticBrowserSignal.ClaudePhantomCursor:
            return AgenticBrowser.Claude;
        case AgenticBrowserSignal.CodexAgentOverlayRoot:
        case AgenticBrowserSignal.CodexBrowserSidebarCommentsRoot:
            return AgenticBrowser.Codex;
        default:
            return AgenticBrowser.None;
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
            case CodexSidebarRoot:
                return AgenticBrowserSignal.CodexBrowserSidebarCommentsRoot;
        }
    }

    return AgenticBrowserSignal.None;
}
