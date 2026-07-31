import { AgenticBrowserSignal, Constant as DataConstant } from "@clarity-types/data";
import { Constant } from "@clarity-types/layout";
import { set } from "@src/data/variable";

let seen: boolean[] = [];

export function start(): void {
    seen = [];
}

export function detect(attributes: { [key: string]: string }): void {
    let signal = identify(attributes[Constant.Id]);
    if (signal && !seen[signal]) {
        seen[signal] = true;
        set(DataConstant.AgenticBrowserSignal, signal.toString());
    }
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
