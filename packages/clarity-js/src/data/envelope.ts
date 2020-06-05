import { BooleanFlag, Token, Upload, Envelope } from "@clarity-types/data";
import version from "@src/core/version";
import * as metadata from "@src/data/metadata";

export let data: Envelope = null;

export function start(): void {
  const m = metadata.data;
  data = {
    version,
    sequence: 0,
    projectId: m.projectId,
    userId: m.userId,
    sessionId: m.sessionId,
    pageId: m.pageId,
    upload: Upload.Async,
    end: BooleanFlag.False
  };
}

export function end(): void {
    data = null;
}

export function envelope(last: boolean): Token[] {
    data.sequence++;
    data.upload = last && "sendBeacon" in navigator ? Upload.Beacon : Upload.Async;
    data.end = last ? BooleanFlag.True : BooleanFlag.False;
    return [data.version, data.sequence, data.projectId, data.userId, data.sessionId, data.pageId, data.upload, data.end];
}
