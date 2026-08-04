import { AgenticBrowserSignal, Dimension } from "@clarity-types/data";
import { Constant } from "@clarity-types/layout";
import * as dimension from "@src/data/dimension";

export function detect(attributes: { [key: string]: string }): void {
    let signal = identify(attributes[Constant.Id]);
    if (signal) { dimension.log(Dimension.AgenticBrowserSignal, signal.toString()); }
}

function identify(id: string): AgenticBrowserSignal {
    switch (id) {
        case "claude-agent-glow-border":
            return AgenticBrowserSignal.ClaudeAgentGlowBorder;
        case "claude-agent-glow-border-inner":
            return AgenticBrowserSignal.ClaudeAgentGlowBorderInner;
        case "claude-agent-stop-container":
            return AgenticBrowserSignal.ClaudeAgentStopContainer;
        case "claude-agent-stop-button":
            return AgenticBrowserSignal.ClaudeAgentStopButton;
        case "claude-phantom-cursor":
            return AgenticBrowserSignal.ClaudePhantomCursor;
        default:
            return AgenticBrowserSignal.None;
    }
}
