import { AgenticBrowserSignal, Dimension } from "@clarity-types/data";
import * as dimension from "@src/data/dimension";

const ClaudeGlowBorder = "claude-agent-glow-border";
const ClaudePhantomCursor = "claude-phantom-cursor";
const CodexOverlayRoot = "codex-agent-overlay-root";
const CodexSidebarRoot = "codex-browser-sidebar-comments-root";

export function detect(id: string, parent: Node): void {
    let signal = identify(id, parent);
    if (signal !== AgenticBrowserSignal.None) {
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
