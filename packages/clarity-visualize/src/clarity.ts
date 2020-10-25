import { Visualize } from "@clarity-types/index";
import { Activity, Constant, MergedPayload, PlaybackState, ResizeHandler } from "@clarity-types/visualize";
import { Data, Interaction, Layout } from "clarity-decode";
import * as data from "./data";
import * as heatmap from "./heatmap";
import * as interaction from "./interaction";
import * as layout from "./layout";
export { dom } from "./layout";

export let state: PlaybackState = null;

export function html(decoded: Data.DecodedPayload[], player: HTMLIFrameElement, hash: string = null): Visualize {
    if (decoded && decoded.length > 0 && player) {
        setup(decoded[0].envelope.version, player);

        // Flatten the payload and parse all events out of them, sorted by time
        let merged = merge(decoded);

        // Render initial markup before rendering rest of the events
        layout.dom(merged.dom);

        // Render all mutations on top of the initial markup
        while (merged.events.length > 0 && layout.exists(hash) === false) {
            let entry = merged.events.shift();
            switch (entry.event) {
                case Data.Event.Mutation:
                    layout.markup(entry as Layout.DomEvent);
                    break;
            }
        }
    }
    return this;
}

export function clickmap(activity: Activity): void {
    if (state === null) { throw new Error(`Initialize heatmap by calling "html" or "setup" prior to making this call.`); }
    heatmap.click(activity);
}

export function merge(decoded: Data.DecodedPayload[]): MergedPayload {
    let merged: MergedPayload = { timestamp: null, envelope: null, dom: null, events: [] };
    for (let payload of decoded) {
        merged.timestamp = merged.timestamp ? merged.timestamp : payload.timestamp;
        merged.envelope = payload.envelope;
        for (let key of Object.keys(payload)) {
            let p = payload[key];
            if (Array.isArray(p)) {
                for (let entry of p) {
                    if (key === Constant.Dom && entry.event === Data.Event.Discover) {
                        merged.dom = entry;
                    } else { merged.events.push(entry); }
                }
            }
        }
    }
    merged.events = merged.events.sort(sort);
    return merged;
}

export function reset(): void {
    data.reset();
    interaction.reset();
    layout.reset();
    heatmap.reset();
    state = null;
}

export function setup(version: string, player: HTMLIFrameElement, onresize: ResizeHandler = null, metadata: HTMLElement = null): Visualize {
    reset();
    state = { version, player, onresize, metadata };
    return this;
}

export function render(events: Data.DecodedEvent[]): void {
    if (state === null) { throw new Error(`Initialize visualization by calling "setup" prior to making this call.`); }
    let time = 0;
    for (let entry of events) {
        time = entry.time;
        switch (entry.event) {
            case Data.Event.Metric:
                data.metric(entry as Data.MetricEvent);
                break;
            case Data.Event.Box:
                layout.box(entry as Layout.BoxEvent);
                break;
            case Data.Event.Mutation:
                layout.markup(entry as Layout.DomEvent);
                break;
            case Data.Event.Region:
                layout.region(entry as Layout.RegionEvent);
                break;
            case Data.Event.MouseDown:
            case Data.Event.MouseUp:
            case Data.Event.MouseMove:
            case Data.Event.MouseWheel:
            case Data.Event.Click:
            case Data.Event.DoubleClick:
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

    if (events.length > 0) {
        // Make any changes, if necessary, at the end of every frame
        layout.update();
        // Update pointer trail at the end of every frame
        interaction.trail(time);
    }
}

function sort(a: Data.DecodedEvent, b: Data.DecodedEvent): number {
    return a.time - b.time;
}
