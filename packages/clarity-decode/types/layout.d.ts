import { Layout } from "clarity-js";
import { PartialEvent } from "./core";

export interface RegionEvent extends PartialEvent { data: Layout.RegionData[]; }
export interface DocumentEvent extends PartialEvent { data: Layout.DocumentData; }
export interface DomEvent extends PartialEvent { data: DomData[]; }
export interface BoxEvent extends PartialEvent { data: Layout.BoxData[]; }
export interface LayoutEvent extends PartialEvent {
    data: Layout.RegionData[] | Layout.DocumentData | DomData[] | Layout.BoxData[];
}

/* Redeclare enums */
export import Constant = Layout.Constant;
export import Interaction = Layout.InteractionState;
export import RegionVisibility = Layout.RegionVisibility;

/* Event Data */
export interface DomData {
    id: number;
    parent: number;
    previous: number;
    tag: string;
    position: number;
    selector: string;
    hash: string;
    attributes?: Layout.Attributes;
    value?: string;
    width?: number;
    height?: number;
}
