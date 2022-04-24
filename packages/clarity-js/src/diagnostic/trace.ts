import {Event} from "@clarity-types/data";
import { TraceData } from "@clarity-types/diagnostic";
import encode from "./encode";
import config from "@src/core/config";

export let data: TraceData = null;

export function start(): void {
  let tagTraceId : string = config.tagTraceId;
  data = {};
  if(tagTraceId){
    data["tagTraceId"] = tagTraceId;
  }
}

export function compute(): void {
    encode(Event.Trace);
}
