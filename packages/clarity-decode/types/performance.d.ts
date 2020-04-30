import { Performance } from "clarity-js";
import { PartialEvent } from "./core";

export interface ConnectionEvent extends PartialEvent { data: Performance.ConnectionData; }
export interface LargestContentfulPaintEvent extends PartialEvent { data: Performance.LargestContentfulPaintData; }
export interface LongTaskEvent extends PartialEvent { data: Performance.LongTaskData; }
export interface MemoryEvent extends PartialEvent { data: Performance.MemoryData; }
export interface NavigationEvent extends PartialEvent { data: Performance.NavigationData; }
export interface NetworkEvent extends PartialEvent { data: Performance.NetworkData[]; }
export interface PaintEvent extends PartialEvent { data: Performance.PaintData; }
export interface PerformanceEvent extends PartialEvent {
    data: Performance.ConnectionData |
    Performance.LargestContentfulPaintData |
    Performance.LongTaskData |
    Performance.MemoryData |
    Performance.NavigationData |
    Performance.NetworkData[] |
    Performance.PaintData;
}
