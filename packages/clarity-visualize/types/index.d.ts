import { ResizeHandler } from "./visualize";
import { Data, Diagnostic, Interaction, Layout } from "clarity-decode"

interface Visualize {
    html: (decoded: Data.DecodedPayload[], player: HTMLIFrameElement) => void;
    render: (events: Data.DecodedEvent[]) =>  void;
    replay: (decoded: Data.DecodedPayload) => void;
    reset: () => void;
    setup: (version: string, player: HTMLIFrameElement, onresize?: ResizeHandler, metadata?: HTMLElement) => void;
}

declare const visualize: Visualize;

export { visualize, Data, Diagnostic, Interaction, Layout, ResizeHandler };
