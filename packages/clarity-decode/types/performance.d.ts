import { Performance } from "clarity-js";
import { PartialEvent } from "./core";

export interface NavigationEvent extends PartialEvent { data: Performance.NavigationData; }
export interface PerformanceEvent extends PartialEvent {
    data: Performance.NavigationData
}
