import { Data, Interaction, Layout } from "clarity-decode";
import * as data from "./data";
import * as interaction from "./interaction";
import * as layout from "./layout";

let pageId: string = null;

export function html(decoded: Data.DecodedPayload[], iframe: HTMLIFrameElement): void {
    reset();
    let events: Data.DecodedEvent[] = [];
    for (let payload of decoded) {
        for (let key in payload) {
            if (Array.isArray(payload[key])) {
                events = events.concat(payload[key]);
            }
        }
    }

    let sortedevents = events.sort(sort)
    for (let entry of sortedevents) {
        switch (entry.event) {
            case Data.Event.Discover:
            case Data.Event.Mutation:
                layout.markup(entry as Layout.DomEvent, iframe);
                break;
        }
    }
}

export function render(decoded: Data.DecodedPayload, iframe: HTMLIFrameElement, header?: HTMLElement): void {
    // Reset rendering if we receive a new pageId or we receive the first sequence
    if (pageId !== decoded.envelope.pageId || decoded.envelope.sequence === 1) {
        pageId = decoded.envelope.pageId;
        reset();
    }

    // Replay events
    let events: Data.DecodedEvent[] = [];
    for (let key in decoded) {
        if (Array.isArray(decoded[key])) {
            events = events.concat(decoded[key]);
        }
    }
    replay(events.sort(sort), iframe, header);
}

export function reset(): void {
    data.reset();
    layout.reset();
}

export async function replay(
    events: Data.DecodedEvent[],
    iframe: HTMLIFrameElement,
    header?: HTMLElement,
    resizeCallback?: (width: number, height: number) => void
): Promise<void> {
    let start = events[0].time;
    for (let entry of events) {
        if (entry.time - start > 16) { start = await wait(entry.time); }

        switch (entry.event) {
            case Data.Event.Page:
                data.page(entry as Data.PageEvent);
                break;
            case Data.Event.Metric:
                if (header) { data.metric(entry as Data.MetricEvent, header); }
                break;
            case Data.Event.Discover:
            case Data.Event.Mutation:
                layout.markup(entry as Layout.DomEvent, iframe);
                break;
            case Data.Event.BoxModel:
                if (data.lean) { layout.boxmodel(entry as Layout.BoxModelEvent, iframe); }
                break;
            case Data.Event.MouseDown:
            case Data.Event.MouseUp:
            case Data.Event.MouseMove:
            case Data.Event.MouseWheel:
            case Data.Event.Click:
            case Data.Event.DoubleClick:
            case Data.Event.RightClick:
            case Data.Event.TouchStart:
            case Data.Event.TouchCancel:
            case Data.Event.TouchEnd:
            case Data.Event.TouchMove:
                interaction.pointer(entry as Interaction.PointerEvent, iframe);
                break;
            case Data.Event.Input:
                interaction.input(entry as Interaction.InputEvent);
                break;
            case Data.Event.Selection:
                interaction.selection(entry as Interaction.SelectionEvent, iframe);
                break;
            case Data.Event.Resize:
                interaction.resize(entry as Interaction.ResizeEvent, iframe, resizeCallback);
                break;
            case Data.Event.Scroll:
                interaction.scroll(entry as Interaction.ScrollEvent, iframe);
                break;
        }
    }
}

async function wait(timestamp: number): Promise<number> {
    return new Promise<number>((resolve: FrameRequestCallback): void => {
        setTimeout(resolve, 10, timestamp);
    });
}

function sort(a: Data.DecodedEvent, b: Data.DecodedEvent): number {
    return a.time - b.time;
}
