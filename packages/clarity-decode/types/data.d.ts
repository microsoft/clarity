import { Data } from "clarity-js";
import { DiagnosticEvent, ImageErrorEvent, InternalErrorEvent, ScriptErrorEvent } from "./diagnostic";
import { ClickEvent, InputEvent, InteractionEvent, PointerEvent, ResizeEvent } from "./interaction";
import { ScrollEvent, SelectionEvent, UnloadEvent, VisibilityEvent } from "./interaction";
import { BoxModelEvent, DocumentEvent, DomEvent, HashEvent, LayoutEvent, ResourceEvent } from "./layout";
import { ConnectionEvent, LargestContentfulPaintEvent, LongTaskEvent, MemoryEvent } from "./performance";
import { NavigationEvent, NetworkEvent, PaintEvent } from "./performance";
import { PartialEvent } from "./core";

/* Redeclare enums */
export import Envelope = Data.Envelope;
export import Code = Data.Code;
export import Event = Data.Event;
export import Metric = Data.Metric;
export import Payload = Data.Payload;

/* Data Events */
export interface MetricEvent extends PartialEvent { data: Data.MetricData; }
export interface PageEvent extends PartialEvent { data: Data.PageData; }
export interface PingEvent extends PartialEvent { data: Data.PingData; }
export interface SummaryEvent extends PartialEvent { data: Data.SummaryData[]; }
export interface TagEvent extends PartialEvent { data: Data.TagData; }
export interface TargetEvent extends PartialEvent { data: Data.TargetData[]; }
export interface UpgradeEvent extends PartialEvent { data: Data.UpgradeData; }
export interface UploadEvent extends PartialEvent { data: Data.UploadData; }
export interface DataEvent extends PartialEvent {
    data: Data.MetricData |
    Data.PageData |
    Data.PingData |
    Data.SummaryData[] |
    Data.TagData |
    Data.TargetData[] |
    Data.UpgradeData |
    Data.UploadData;
}

export type DecodedEvent = DataEvent | DiagnosticEvent | InteractionEvent | LayoutEvent;

export interface DecodedPayload {
    timestamp: number;
    envelope: Data.Envelope;
    ua?: string;
    metric?: MetricEvent[];
    page?: PageEvent[];
    ping?: PingEvent[];
    tag?: TagEvent[];
    image?: ImageErrorEvent[];
    script?: ScriptErrorEvent[];
    input?: InputEvent[];
    pointer?: PointerEvent[];
    click?: ClickEvent[];
    resize?: ResizeEvent[];
    scroll?: ScrollEvent[];
    selection?: SelectionEvent[];
    summary?: SummaryEvent[];
    unload?: UnloadEvent[];
    upgrade?: UpgradeEvent[];
    upload?: UploadEvent[];
    visibility?: VisibilityEvent[];
    boxmodel?: BoxModelEvent[];
    hash?: HashEvent[];
    resource?: ResourceEvent[];
    dom?: DomEvent[];
    doc?: DocumentEvent[];
    target?: TargetEvent[];
    connection?: ConnectionEvent[];
    contentfulPaint?: LargestContentfulPaintEvent[];
    longtask?: LongTaskEvent[];
    memory?: MemoryEvent[];
    navigation?: NavigationEvent[];
    network?: NetworkEvent[];
    paint?: PaintEvent[];
    internal?: InternalErrorEvent[];
}

export interface DecodedVersion {
    major: number;
    minor: number;
    patch: number;
    beta: number;
}
