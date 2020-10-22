import { Activity, MergedPayload, ResizeHandler } from "./visualize";
import { Data, Diagnostic, Interaction, Layout } from "clarity-decode"

export interface Visualize {
    dom: (event: Layout.DomEvent) => Promise<void>;
    html: (decoded: Data.DecodedPayload[], player: HTMLIFrameElement, hash?: string) => Visualize;
    clickmap: (activity?: Activity) => void;
    merge: (decoded: Data.DecodedPayload[]) => MergedPayload;
    render: (events: Data.DecodedEvent[]) =>  void;
    reset: () => void;
    setup: (version: string, player: HTMLIFrameElement, onresize?: ResizeHandler, metadata?: HTMLElement) => Visualize;
}

declare const visualize: Visualize;

export { visualize, Data, Diagnostic, Interaction, Layout, MergedPayload, ResizeHandler };
