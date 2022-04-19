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
export import Interaction = Layout.InteractionState;
export import RegionVisibility = Layout.RegionVisibility;
export import SelectorInput = Layout.SelectorInput;

/* Event Data */
export interface DomData {
    id: number;
    parent: number;
    previous: number;
    tag: string;
    attributes?: Layout.Attributes;
    value?: string;
    width?: number;
    height?: number;
    selector?: string;
    hash?: string;
    selectorBeta?: string;
    hashBeta?: string;
}
