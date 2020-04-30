import { Layout } from "clarity-js";
import { PartialEvent } from "./core";

export interface BoxModelEvent extends PartialEvent { data: Layout.BoxModelData[]; }
export interface HashEvent extends PartialEvent { data: Layout.HashData[]; }
export interface DocumentEvent extends PartialEvent { data: Layout.DocumentData; }
export interface DomEvent extends PartialEvent { data: DomData[]; }
export interface ResourceEvent extends PartialEvent { data: Layout.ResourceData[]; }
export interface LayoutEvent extends PartialEvent {
    data: Layout.BoxModelData[] | Layout.HashData[] | Layout.DocumentData | DomData[] | Layout.ResourceData[];
}

/* Redeclare enums */
export import Constant = Layout.Constant;

/* Event Data */
export interface DomData {
    id: number;
    parent: number;
    next: number;
    tag: string;
    position: number;
    attributes?: Layout.Attributes;
    value?: string;
}
