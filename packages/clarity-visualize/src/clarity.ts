import { Visualize } from "@clarity-types/index";
import { Activity, Constant, MergedPayload, Options, PlaybackState, ScrollMapInfo } from "@clarity-types/visualize";
import { Data, Interaction, Layout } from "clarity-decode";
import * as data from "./data";
import * as heatmap from "./heatmap";
import * as interaction from "./interaction";
import * as layout from "./layout";
export { dom } from "./layout";

export let state: PlaybackState = null;
let renderTime = 0;

export function html(decoded: Data.DecodedPayload[], target: Window, hash: string = null, time : number): Visualize {
    if (decoded && decoded.length > 0 && target) {
        // Flatten the payload and parse all events out of them, sorted by time
        let merged = merge(decoded);
    
        setup(target, { version: decoded[0].envelope.version, dom: merged.dom });

        // Render all mutations on top of the initial markup
        while (merged.events.length > 0 && layout.exists(hash) === false) {
            let entry = merged.events.shift();
            switch (entry.event) {
                case Data.Event.Mutation:
                    let domEvent = entry as Layout.DomEvent;
                    renderTime = domEvent.time;
                    if (time && renderTime > time) {
                        break;
                    }

                    layout.markup(domEvent);
                    break;
            }
        }
    }

    return this;
}

export function time(): number {
    return renderTime;
}

export function clickmap(activity: Activity): void {
    if (state === null) { throw new Error(`Initialize heatmap by calling "html" or "setup" prior to making this call.`); }
    heatmap.click(activity);
}

export function clearmap(): void {
    if (state === null) { throw new Error(`Initialize heatmap by calling "html" or "setup" prior to making this call.`); }
    heatmap.clear();
}

export function scrollmap(scrollData: ScrollMapInfo[], avgFold: number): void {
    if (state === null) { throw new Error(`Initialize heatmap by calling "html" or "setup" prior to making this call.`); }
    heatmap.scroll(scrollData, avgFold);
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

export function setup(target: Window, options: Options): Visualize {
    reset();
    // Infer options
    options.canvas = "canvas" in options ? options.canvas : true;
    options.keyframes = "keyframes" in options ? options.keyframes : false;

    // Set visualization state
    state = { window: target, options };

    // If discover event was passed, render it now
    if (options.dom) { layout.dom(options.dom); }

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
            case Data.Event.Region:
                data.region(entry as Layout.RegionEvent);
                break;
            case Data.Event.Box:
                layout.box(entry as Layout.BoxEvent);
                break;
            case Data.Event.Mutation:
                layout.markup(entry as Layout.DomEvent);
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
            case Data.Event.Visibility:
                interaction.visibility(entry as Interaction.VisibilityEvent);
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
        // Update pointer trail at the end of every frame
        interaction.trail(time);
    }
}

function reset(): void {
    data.reset();
    interaction.reset();
    layout.reset();
    heatmap.reset();
    state = null;
    renderTime = 0;
}

function sort(a: Data.DecodedEvent, b: Data.DecodedEvent): number {
    return a.time - b.time;
}
