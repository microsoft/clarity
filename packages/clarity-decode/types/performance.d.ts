import { Performance } from "clarity-js";
import { PartialEvent } from "./core";

export interface ConnectionEvent extends PartialEvent { data: Performance.ConnectionData; }
export interface NavigationEvent extends PartialEvent { data: Performance.NavigationData; }
export interface PerformanceEvent extends PartialEvent {
    data: Performance.ConnectionData | Performance.NavigationData
}
