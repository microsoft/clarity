import { Dimension } from "@clarity-types/data";
import config from "@src/core/config";
import * as dimension from "@src/data/dimension";

export function compute(): void {
  if (config.tagTraceId) { dimension.log(Dimension.TraceId, config.tagTraceId) }
}
