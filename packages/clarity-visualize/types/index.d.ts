import { Data, Diagnostic, Interaction, Layout } from "clarity-decode"

interface Visualize {
    html: (decoded: Data.DecodedPayload[], iframe: HTMLIFrameElement) => void;
    render: (decoded: Data.DecodedPayload, iframe: HTMLIFrameElement, header?: HTMLElement) => void;
    replay: (events: Data.DecodedEvent[], iframe: HTMLIFrameElement, header?: HTMLElement, resizeCallback?: (width: number, height: number) => void) => Promise<void>;
    reset: () => void;
}

declare const visualize: Visualize;

export { visualize, Data, Diagnostic, Interaction, Layout };
