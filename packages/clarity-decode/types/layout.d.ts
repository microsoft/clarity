import { Layout } from "clarity-js";
import { PartialEvent } from "./core";

export interface RegionEvent extends PartialEvent { data: Layout.RegionData[]; }
export interface DocumentEvent extends PartialEvent { data: Layout.DocumentData; }
export interface DomEvent extends PartialEvent { data: DomData[]; }
export interface LayoutEvent extends PartialEvent {
    data: Layout.RegionData[] | Layout.DocumentData | DomData[];
}

/* Redeclare enums */
export import Constant = Layout.Constant;

/* Event Data */
export interface DomData {
    id: number;
    parent: number;
    previous: number;
    tag: string;
    position: number;
    selector: string;
    hash: number;
    attributes?: Layout.Attributes;
    value?: string;
    next?: number; /* deprecated since v0.4.5 */
}
