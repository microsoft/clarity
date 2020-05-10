import { Container, ResizeHandler } from "./visualize";
import { Data, Diagnostic, Interaction, Layout } from "clarity-decode"

interface Visualize {
    html: (decoded: Data.DecodedPayload[]) => void;
    render: (events: Data.DecodedEvent[]) =>  void;
    replay: (decoded: Data.DecodedPayload) => void;
    setup: (envelope: Data.Envelope, container: Container, onresize?: ResizeHandler) => void;
}

declare const visualize: Visualize;

export { visualize, Data, Diagnostic, Interaction, Layout, Container, ResizeHandler };
