import { Activity, Constant, ErrorLogger, LinkHandler, MergedPayload, Options, PlaybackState, ScrollMapInfo, Visualizer as VisualizerType } from "@clarity-types/visualize";
import { Data } from "clarity-js";
import type { Data as DecodedData, Interaction, Layout } from "clarity-decode";
import { DataHelper } from "./data";
import { EnrichHelper } from "./enrich";
import { HeatmapHelper } from "./heatmap";
import { InteractionHelper } from "./interaction";
import { LayoutHelper } from "./layout";

export class Visualizer implements VisualizerType {
    _state: PlaybackState = null;
    renderTime = 0;

    enrich: EnrichHelper;
    layout: LayoutHelper;
    heatmap: HeatmapHelper;
    interaction: InteractionHelper;
    data: DataHelper;

    public get state() {
        return this._state;
    }

    public dom = async (event: Layout.DomEvent): Promise<void> => {
        await this.layout.dom(event);
    }

    public get = (hash: string): HTMLElement => {
        return this.layout?.get(hash);
    }

    public html = async (decoded: DecodedData.DecodedPayload[], target: Window, hash: string = null, time : number, useproxy?: LinkHandler, logerror?: ErrorLogger): Promise<Visualizer> => {
        if (decoded && decoded.length > 0 && target) {
            try {
                // Flatten the payload and parse all events out of them, sorted by time
                let merged = this.merge(decoded);

                this.setup(target, { version: decoded[0].envelope.version, dom: merged.dom, useproxy });

                // Render all mutations on top of the initial markup
                while (merged.events.length > 0 && this.layout.exists(hash) === false) {
                    let entry = merged.events.shift();
                    switch (entry.event) {
                        case Data.Event.Mutation:
                            let domEvent = entry as Layout.DomEvent;
                            this.renderTime = domEvent.time;
                            if (time && this.renderTime > time) {
                                break;
                            }
                            await this.layout.markup(domEvent, useproxy);
                            break;
                    }
                }
            } catch (e) {
                if (logerror) {
                    logerror(e);
                }
            }
        }

        return this;
    }

    public time = (): number => {
        return this.renderTime;
    }

    public clickmap = (activity: Activity): void => {
        if (this.state === null) { throw new Error(`Initialize heatmap by calling "html" or "setup" prior to making this call.`); }
        this.heatmap.click(activity);
    }

    public clearmap = (): void => {
        if (this.state === null) { throw new Error(`Initialize heatmap by calling "html" or "setup" prior to making this call.`); }
        this.heatmap.clear();
    }

    public scrollmap = (scrollData: ScrollMapInfo[], avgFold: number, addMarkers: boolean): void => {
        if (this.state === null) { throw new Error(`Initialize heatmap by calling "html" or "setup" prior to making this call.`); }
        this.heatmap.scroll(scrollData, avgFold, addMarkers);
    }

    public merge = (decoded: DecodedData.DecodedPayload[]): MergedPayload => {
        let merged: MergedPayload = { timestamp: null, envelope: null, dom: null, events: [] };

        // Re-arrange decoded payloads in the order of their start time
        decoded = decoded.sort(this.sortPayloads);
        // Re-initialize enrich class if someone ends up calling merge function directly
        this.enrich = this.enrich || new EnrichHelper();
        this.enrich.reset();
        // Walk through payloads and generate merged payload from an array of decoded payloads
        for (let payload of decoded) {
            merged.timestamp = merged.timestamp ? merged.timestamp : payload.timestamp;
            merged.envelope = payload.envelope;
            for (let key of Object.keys(payload)) {
                let p = payload[key];
                if (Array.isArray(p)) {
                    for (let entry of p) {
                        switch (key) {
                            case Constant.Dom:
                                let dom = this.enrich.selectors(entry);
                                if (entry.event === Data.Event.Discover) {
                                    merged.dom = dom;
                                } else {
                                    merged.events.push(entry);
                                }
                                break;
                            default:
                                merged.events.push(entry);
                                break;
                        }
                    }
                }
            }
        }
        merged.events = merged.events.sort(this.sortEvents);
        return merged;
    }

    public setup = (target: Window, options: Options): Visualizer => {
        this.reset();
        // Infer options
        options.canvas = "canvas" in options ? options.canvas : true;
        options.keyframes = "keyframes" in options ? options.keyframes : false;

        // Set visualization state
        this._state = { window: target, options };

        // Initialize helpers
        this.enrich = new EnrichHelper();
        this.data = new DataHelper(this.state);
        this.layout = new LayoutHelper(this.state);
        this.heatmap = new HeatmapHelper(this.state, this.layout);
        this.interaction = new InteractionHelper(this.state, this.layout);

        // If discover event was passed, render it now
        if (options.dom) { this.layout.dom(options.dom, options.useproxy); }

        return this;
    }

    public render = async (events: DecodedData.DecodedEvent[]): Promise<void> => {
        if (this.state === null) { throw new Error(`Initialize visualization by calling "setup" prior to making this call.`); }
        let time = 0;
        for (let entry of events) {
            time = entry.time;
            switch (entry.event) {
                case Data.Event.Metric:
                    this.data.metric(entry as DecodedData.MetricEvent);
                    break;
                case Data.Event.Region:
                    this.data.region(entry as Layout.RegionEvent);
                    break;
                case Data.Event.Mutation:
                    await this.layout.markup(entry as Layout.DomEvent);
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
                    this.interaction.pointer(entry as Interaction.PointerEvent);
                    break;
                case Data.Event.Visibility:
                    this.interaction.visibility(entry as Interaction.VisibilityEvent);
                    break;
                case Data.Event.Input:
                    this.interaction.input(entry as Interaction.InputEvent);
                    break;
                case Data.Event.Selection:
                    this.interaction.selection(entry as Interaction.SelectionEvent);
                    break;
                case Data.Event.Resize:
                    this.interaction.resize(entry as Interaction.ResizeEvent);
                    break;
                case Data.Event.Scroll:
                    this.interaction.scroll(entry as Interaction.ScrollEvent);
                    break;
            }
        }

        if (events.length > 0) {
            // Update pointer trail at the end of every frame
            this.interaction.trail(time);
        }
    }

    private reset = (): void => {
        this.data?.reset();
        this.interaction?.reset();
        this.layout?.reset();
        this.heatmap?.reset();
        this.enrich?.reset();

        this._state = null;
        this.renderTime = 0;
    }

    private sortEvents = (a: DecodedData.DecodedEvent, b: DecodedData.DecodedEvent): number => {
        return a.time - b.time;
    }

    private sortPayloads = (a: DecodedData.DecodedPayload, b: DecodedData.DecodedPayload): number => {
        return a.envelope.sequence - b.envelope.sequence;
    }
}
