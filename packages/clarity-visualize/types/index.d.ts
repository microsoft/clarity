import { MergedPayload, ResizeHandler } from "./visualize";
import { Data, Diagnostic, Interaction, Layout } from "clarity-decode"

interface Visualize {
    dom: (event: Layout.DomEvent) => Promise<void>;
    html: (decoded: Data.DecodedPayload[], player: HTMLIFrameElement) => void;
    merge: (decoded: Data.DecodedPayload[]) => MergedPayload;
    render: (events: Data.DecodedEvent[]) =>  void;
    replay: (decoded: Data.DecodedPayload) => void;
    reset: () => void;
    setup: (version: string, player: HTMLIFrameElement, onresize?: ResizeHandler, metadata?: HTMLElement) => void;
}

declare const visualize: Visualize;

export { visualize, Data, Diagnostic, Interaction, Layout, MergedPayload, ResizeHandler };
