import { Core, Data } from "clarity-js/types";

export import Config = Core.Config;

export interface PartialEvent {
    time: number;
    event: Data.Event;
}
