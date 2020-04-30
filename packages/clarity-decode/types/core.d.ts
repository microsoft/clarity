import { Data } from "clarity-js";

export interface PartialEvent {
    time: number;
    event: Data.Event;
}
