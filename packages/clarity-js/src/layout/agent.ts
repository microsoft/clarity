import { AgenticBrowserSignal, Dimension } from "@clarity-types/data";
import * as dimension from "@src/data/dimension";

export function detect(id: string): void {
    let signal = identify(id);
    if (signal) { dimension.log(Dimension.AgenticBrowserSignal, signal.toString()); }
}

function identify(id: string): AgenticBrowserSignal {
    switch (id) {
        case "claude-agent-glow-border":
        case "claude-agent-stop-container":
        case "claude-phantom-cursor":
            return AgenticBrowserSignal.Claude;
        case "codex-agent-overlay-root":
            return AgenticBrowserSignal.Codex;
        default:
            return AgenticBrowserSignal.None;
    }
}
