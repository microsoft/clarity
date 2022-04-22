import {Event} from "@clarity-types/data";
import { TraceData } from "@clarity-types/diagnostic";
import encode from "./encode";

export let data: TraceData = null;

export function trace(tagTraceId?: string): void {
  data = {};
  if(tagTraceId){
    data["tagTraceId"] = tagTraceId;
  }
}

export function compute(): void {
    encode(Event.Trace);
}
