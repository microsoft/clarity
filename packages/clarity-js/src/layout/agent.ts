import { AgenticBrowserSignal, Dimension } from "@clarity-types/data";
import * as dimension from "@src/data/dimension";

const ClaudeGlowBorder = "claude-agent-glow-border";
const ClaudePhantomCursor = "claude-phantom-cursor";
const CodexOverlayRoot = "codex-agent-overlay-root";
const CodexSidebarRoot = "codex-browser-sidebar-comments-root";

let seen: boolean[] = [];

export function start(): void {
    seen = [false, false];
    scan();
}

export function scan(): void {
    detect(document.getElementById(ClaudeGlowBorder));
    detect(document.getElementById(ClaudePhantomCursor));
    detect(document.getElementById(CodexOverlayRoot));
    detect(document.getElementById(CodexSidebarRoot));
}

export function detect(node: Node, parent: Node = null): void {
    if (seen[0] && seen[1] || !node || node.nodeType !== Node.ELEMENT_NODE) { return; }

    let element = node as HTMLElement;
    let signal = identify(element.id, parent || element.parentElement);
    let index = signal === AgenticBrowserSignal.CodexAgentOverlayRoot ||
        signal === AgenticBrowserSignal.CodexBrowserSidebarCommentsRoot ? 1 : 0;
    if (signal && !seen[index]) {
        seen[index] = true;
        dimension.log(Dimension.AgenticBrowserSignal, signal.toString());
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
