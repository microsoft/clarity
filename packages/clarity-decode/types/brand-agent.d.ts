import { PartialEvent } from "./core";

export interface BrandAgentData {
    name: string;
    msg: string;
    cid: string;
}

export interface BrandAgentEvent extends PartialEvent { data: BrandAgentData; }
