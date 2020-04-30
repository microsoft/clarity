import { Data, version } from "clarity-js";
import { DecodedPayload, DecodedVersion } from "../types/data";
import { MetricEvent, PageEvent, PingEvent, SummaryEvent, TagEvent, TargetEvent, UpgradeEvent, UploadEvent } from "../types/data";
import { ImageErrorEvent, InternalErrorEvent, ScriptErrorEvent } from "../types/diagnostic";
import { ClickEvent, InputEvent, PointerEvent, ResizeEvent, ScrollEvent } from "../types/interaction";
import { SelectionEvent, UnloadEvent, VisibilityEvent } from "../types/interaction";
import { BoxModelEvent, DocumentEvent, DomEvent, HashEvent, ResourceEvent } from "../types/layout";
import { ConnectionEvent, LargestContentfulPaintEvent, LongTaskEvent, MemoryEvent } from "../types/performance";
import { NavigationEvent, NetworkEvent, PaintEvent } from "../types/performance";

import * as data from "./data";
import * as diagnostic from "./diagnostic";
import * as interaction from "./interaction";
import * as layout from "./layout";
import * as performance from "./performance";

export function decode(input: string): DecodedPayload {
    let json: Data.Payload = JSON.parse(input);
    let envelope = data.envelope(json.e);
    let timestamp = Date.now();
    let payload: DecodedPayload = { timestamp, envelope };
    // Sort encoded events by time to simplify summary computation
    let encoded: Data.Token[][] = json.d.sort((a: Data.Token[], b: Data.Token[]): number => (a[0] as number) - (b[0] as number));

    // Check if the incoming version is compatible with the current running code
    // We do an exact match for major, minor and path components of the version.
    // However, the beta portion of the version can be either same, one less or one more.
    // This ensures we are backward and forward compatible with upto one version change.
    let jsonVersion = parseVersion(payload.envelope.version);
    let codeVersion = parseVersion(version);

    if (jsonVersion.major !== codeVersion.major ||
        jsonVersion.minor !== codeVersion.minor ||
        Math.abs(jsonVersion.patch - codeVersion.patch) > 1) {
        throw new Error(`Invalid version. Actual: ${payload.envelope.version} | Expected: ${version} (+/- 1) | ${input.substr(0, 250)}`);
    }

    /* Reset components before decoding to keep them stateless */
    data.reset();
    layout.reset();

    for (let entry of encoded) {
        data.summarize(entry);
        switch (entry[1]) {
            case Data.Event.Page:
                if (payload.page === undefined) { payload.page = []; }
                payload.page.push(data.decode(entry) as PageEvent);
                break;
            case Data.Event.Ping:
                if (payload.ping === undefined) { payload.ping = []; }
                payload.ping.push(data.decode(entry) as PingEvent);
                break;
            case Data.Event.Tag:
                if (payload.tag === undefined) { payload.tag = []; }
                payload.tag.push(data.decode(entry) as TagEvent);
                break;
            case Data.Event.Target:
                if (payload.target === undefined) { payload.target = []; }
                payload.target.push(data.decode(entry) as TargetEvent);
                break;
            case Data.Event.Upgrade:
                if (payload.upgrade === undefined) { payload.upgrade = []; }
                payload.upgrade.push(data.decode(entry) as UpgradeEvent);
                break;
            case Data.Event.Metric:
                if (payload.metric === undefined) { payload.metric = []; }
                let metric = data.decode(entry) as MetricEvent;
                // It's not possible to accurately include the byte count of the payload within the same payload
                // So, we increment the bytes from the incoming payload at decode time.
                // Also, initialize TotalBytes if it doesn't exist. For the first payload, this value can be null.
                if (!(Data.Metric.TotalBytes in metric.data)) { metric.data[Data.Metric.TotalBytes] = 0; }
                metric.data[Data.Metric.TotalBytes] += input.length;
                payload.metric.push(metric);
                break;
            case Data.Event.Upload:
                if (payload.upload === undefined) { payload.upload = []; }
                payload.upload.push(data.decode(entry) as UploadEvent);
                break;
            case Data.Event.MouseDown:
            case Data.Event.MouseUp:
            case Data.Event.MouseMove:
            case Data.Event.MouseWheel:
            case Data.Event.DoubleClick:
            case Data.Event.TouchStart:
            case Data.Event.TouchCancel:
            case Data.Event.TouchEnd:
            case Data.Event.TouchMove:
                if (payload.pointer === undefined) { payload.pointer = []; }
                payload.pointer.push(interaction.decode(entry) as PointerEvent);
                break;
            case Data.Event.Click:
                if (payload.click === undefined) { payload.click = []; }
                let clickEntry = interaction.decode(entry) as ClickEvent;
                payload.click.push(clickEntry);

                // Extra processing introduced for backward compatibility in v1.0.0-b21.
                if (payload.pointer === undefined) { payload.pointer = []; }
                let clickData = clickEntry.data;
                payload.pointer.push({
                    time: clickEntry.time, event: clickEntry.event, data: {
                        target: clickData.target,
                        x: clickData.x,
                        y: clickData.y
                    }
                } as PointerEvent);
                break;
            case Data.Event.Scroll:
                if (payload.scroll === undefined) { payload.scroll = []; }
                payload.scroll.push(interaction.decode(entry) as ScrollEvent);
                break;
            case Data.Event.Resize:
                if (payload.resize === undefined) { payload.resize = []; }
                payload.resize.push(interaction.decode(entry) as ResizeEvent);
                break;
            case Data.Event.Selection:
                if (payload.selection === undefined) { payload.selection = []; }
                payload.selection.push(interaction.decode(entry) as SelectionEvent);
                break;
            case Data.Event.Input:
                if (payload.input === undefined) { payload.input = []; }
                payload.input.push(interaction.decode(entry) as InputEvent);
                break;
            case Data.Event.Unload:
                if (payload.unload === undefined) { payload.unload = []; }
                payload.unload.push(interaction.decode(entry) as UnloadEvent);
                break;
            case Data.Event.Visibility:
                if (payload.visibility === undefined) { payload.visibility = []; }
                payload.visibility.push(interaction.decode(entry) as VisibilityEvent);
                break;
            case Data.Event.BoxModel:
                if (payload.boxmodel === undefined) { payload.boxmodel = []; }
                payload.boxmodel.push(layout.decode(entry) as BoxModelEvent);
                break;
            case Data.Event.Discover:
            case Data.Event.Mutation:
                if (payload.dom === undefined) { payload.dom = []; }
                payload.dom.push(layout.decode(entry) as DomEvent);
                break;
            case Data.Event.Document:
                if (payload.doc === undefined) { payload.doc = []; }
                payload.doc.push(layout.decode(entry) as DocumentEvent);
                break;
            case Data.Event.ScriptError:
                if (payload.script === undefined) { payload.script = []; }
                payload.script.push(diagnostic.decode(entry) as ScriptErrorEvent);
                break;
            case Data.Event.ImageError:
                if (payload.image === undefined) { payload.image = []; }
                payload.image.push(diagnostic.decode(entry) as ImageErrorEvent);
                break;
            case Data.Event.InternalError:
                if (payload.internal === undefined) { payload.internal = []; }
                payload.internal.push(diagnostic.decode(entry) as InternalErrorEvent);
                break;
            case Data.Event.Connection:
                if (payload.connection === undefined) { payload.connection = []; }
                payload.connection.push(performance.decode(entry) as ConnectionEvent);
                break;
            case Data.Event.ContentfulPaint:
                if (payload.contentfulPaint === undefined) { payload.contentfulPaint = []; }
                payload.contentfulPaint.push(performance.decode(entry) as LargestContentfulPaintEvent);
                break;
            case Data.Event.LongTask:
                if (payload.longtask === undefined) { payload.longtask = []; }
                payload.longtask.push(performance.decode(entry) as LongTaskEvent);
                break;
            case Data.Event.Memory:
                if (payload.memory === undefined) { payload.memory = []; }
                payload.memory.push(performance.decode(entry) as MemoryEvent);
                break;
            case Data.Event.Navigation:
                if (payload.navigation === undefined) { payload.navigation = []; }
                payload.navigation.push(performance.decode(entry) as NavigationEvent);
                break;
            case Data.Event.Network:
                if (payload.network === undefined) { payload.network = []; }
                payload.network.push(performance.decode(entry) as NetworkEvent);
                break;
            case Data.Event.Paint:
                if (payload.paint === undefined) { payload.paint = []; }
                payload.paint.push(performance.decode(entry) as PaintEvent);
                break;
            default:
                console.error(`No handler for Event: ${JSON.stringify(entry)}`);
                break;
        }
    }

    /* Enrich decoded payload with derived events */
    payload.summary = data.summary() as SummaryEvent[];
    if (payload.dom && payload.dom.length > 0) { payload.hash = layout.hash() as HashEvent[]; }
    if (layout.resources.length > 0) { payload.resource = layout.resource() as ResourceEvent[]; }

    return payload;
}


function parseVersion(ver: string): DecodedVersion {
    let output: DecodedVersion = { major: 0, minor: 0, patch: 0, beta: 0 };
    let parts = ver.split(".");
    if (parts.length === 3) {
        let subparts = parts[2].split("-b");
        output.major = parseInt(parts[0], 10);
        output.minor = parseInt(parts[1], 10);
        if (subparts.length === 2) {
            output.patch = parseInt(subparts[0], 10);
            output.beta = parseInt(subparts[1], 10);
        } else { output.patch = parseInt(parts[2], 10); }
    }
    return output;
}
