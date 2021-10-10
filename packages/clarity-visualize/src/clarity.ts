import { Visualize } from "@clarity-types/index";
import { Activity, Constant, MergedPayload, NodeData, Options, PlaybackState, ScrollMapInfo } from "@clarity-types/visualize";
import { Data, Interaction, Layout } from "clarity-decode";
import { helper } from "clarity-js";
import * as data from "./data";
import * as heatmap from "./heatmap";
import * as interaction from "./interaction";
import * as layout from "./layout";
export { dom, get } from "./layout";

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

export function scrollmap(scrollData: ScrollMapInfo[], avgFold: number, addMarkers: boolean): void {
    if (state === null) { throw new Error(`Initialize heatmap by calling "html" or "setup" prior to making this call.`); }
    heatmap.scroll(scrollData, avgFold, addMarkers);
}

export function merge(decoded: Data.DecodedPayload[]): MergedPayload {
    let merged: MergedPayload = { timestamp: null, envelope: null, dom: null, events: [] };
    // Re-arrange decoded payloads in the order of their start time
    decoded = decoded.sort(sortPayloads);
    // Reset children & selectors if someone ends up calling merge function directly
    if (decoded[0].envelope.sequence === 1) { state = state || { window: null, options: null, children: {}, nodes: {} }; }
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
                            // Enrich DomData with selector and hash information
                            let dom = entry as Layout.DomEvent;
                            dom.data.forEach(d => {
                                let parent = state.nodes[d.parent];
                                let children = state.children[d.parent] || [];
                                let node = state.nodes[d.id] || { tag: d.tag, parent: d.parent, previous: d.previous };
                                let attributes = d.attributes || {};
                                let usePosition = ["DIV", "TR", "P", "LI", "UL", "A", "BUTTON"].indexOf(d.tag) >= 0 || !(Layout.Constant.Class in attributes);

                                /* Track parent-child relationship for this element */
                                if (node.parent !== d.parent) {
                                    let childIndex = d.previous === null ? 0 : children.indexOf(d.previous) + 1;
                                    children.splice(childIndex, 0, d.id);

                                    // Stop tracking this node from children of previous parent
                                    if (node.parent !== d.parent) {
                                        let exParent = state.children[node.parent];
                                        let nodeIndex = exParent ? exParent.indexOf(d.id) : -1;
                                        if (nodeIndex >= 0) {
                                            state.children[node.parent].splice(nodeIndex, 1);
                                        }
                                    }
                                    node.parent = d.parent;
                                } else if (children.indexOf(d.id) < 0) { children.push(d.id); }
                                
                                /* Get current position */
                                node.position = position(d.id, d.tag, node, children, children.map(c => state.nodes[c]));

                                /* For backward compatibility, continue populating current selector and hash like before in addition to beta selector and hash */
                                d.selector = helper.selector(d.tag, parent ? parent.stable : null, attributes, usePosition ? node.position : null);
                                d.selectorBeta = helper.selector(d.tag, parent ? parent.beta : null, attributes, node.position, true);
                                d.hash = helper.hash(d.selector);
                                d.hashBeta = helper.hash(d.selectorBeta);

                                /* Track state for future reference */
                                node.stable = d.selector;
                                node.beta = d.selectorBeta;
                                state.nodes[d.id] = node;
                                if (d.parent) { state.children[d.parent] = children; }                             
                            });
                            if (entry.event === Data.Event.Discover) { merged.dom = dom; } else {
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
    merged.events = merged.events.sort(sortEvents);
    return merged;
}

export function setup(target: Window, options: Options): Visualize {
    reset();
    // Infer options
    options.canvas = "canvas" in options ? options.canvas : true;
    options.keyframes = "keyframes" in options ? options.keyframes : false;

    // Set visualization state
    state = { window: target, options, children: {}, nodes: {} };

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

function sortEvents(a: Data.DecodedEvent, b: Data.DecodedEvent): number {
    return a.time - b.time;
}

function sortPayloads(a: Data.DecodedPayload, b: Data.DecodedPayload): number {
    return a.envelope.sequence - b.envelope.sequence;
}

function position(id: number, tag: string, child: NodeData, children: number[], siblings: NodeData[]): number {
    child.position = 1;
    let idx = children ? children.indexOf(id) : -1;
    while (idx-- > 0) {
        if (tag === siblings[idx].tag) {
            child.position = siblings[idx].position + 1;
            break;
        }
    }
    return child.position;
}