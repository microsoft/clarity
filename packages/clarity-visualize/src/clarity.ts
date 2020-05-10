import { Container, PlaybackState, ResizeHandler } from "@clarity-types/visualize";
import { Data, Interaction, Layout } from "clarity-decode";
import * as data from "./data";
import * as interaction from "./interaction";
import * as layout from "./layout";

export let state: PlaybackState = null;

export function html(decoded: Data.DecodedPayload[], player: HTMLIFrameElement): void {
    if (decoded.length === 0) { return; }
    state = { version: decoded[0].envelope.version, player, metrics: null, onresize: null };

    // Flatten the payload and parse all events out of them, sorted by time
    let events = process(decoded);

    // Walk through all events
    while (events.length > 0) {
        let entry = events.shift();
        switch (entry.event) {
            case Data.Event.Discover:
            case Data.Event.Mutation:
                layout.markup(entry as Layout.DomEvent);
                break;
        }
    }
}

export async function replay(decoded: Data.DecodedPayload): Promise<void> {
    if (state === null) { throw new Error(`Initialize visualization by calling "setup" prior to making this call.`); }

    // Flatten the payload and parse all events out of them, sorted by time
    // Call render method on these events
    render(process([decoded]));
}

export function setup(envelope: Data.Envelope, container: Container, onresize: ResizeHandler = null): void {
    state = {
        version: envelope.version,
        player: container.player,
        metrics: container.metrics ? container.metrics : null,
        onresize
    }
    data.reset();
    interaction.reset();
    layout.reset();
}

export function render(events: Data.DecodedEvent[]): void {
    if (state === null) { throw new Error(`Initialize visualization by calling "setup" prior to making this call.`); }
    let time = 0;
    for (let entry of events) {
        time = entry.time;
        switch (entry.event) {
            case Data.Event.Page:
                data.page(entry as Data.PageEvent);
                break;
            case Data.Event.Metric:
                data.metric(entry as Data.MetricEvent);
                break;
            case Data.Event.Discover:
            case Data.Event.Mutation:
                layout.markup(entry as Layout.DomEvent);
                break;
            case Data.Event.BoxModel:
                if (data.lean) { layout.boxmodel(entry as Layout.BoxModelEvent); }
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
                interaction.pointer(entry as Interaction.PointerEvent);
                break;
            case Data.Event.Input:
                interaction.input(entry as Interaction.InputEvent);
                break;
            case Data.Event.Selection:
                interaction.selection(entry as Interaction.SelectionEvent);
                break;
            case Data.Event.Resize:
                interaction.resize(entry as Interaction.ResizeEvent);
                break;
            case Data.Event.Scroll:
                interaction.scroll(entry as Interaction.ScrollEvent);
                break;
        }
    }

    // Update pointer trail at the end of every frame
    if (events.length > 0) { interaction.trail(time); }
}

function process(decoded: Data.DecodedPayload[]): Data.DecodedEvent[] {
    let events: Data.DecodedEvent[] = [];
    for (let payload of decoded) {
        for (let key in payload) {
            if (Array.isArray(payload[key])) {
                events = events.concat(payload[key]);
            }
        }
    }
    return events.sort(sort);
}

function sort(a: Data.DecodedEvent, b: Data.DecodedEvent): number {
    return a.time - b.time;
}
