import { ClarityApi, RecordKind, toolNameIds, WebMcpRecord } from "./common";

export const WEBMCP_EVENT_ID = 205;
export const MAX_USAGE_EVENTS = 100;

// WebMCP draft requires tool names to be 1-128 ASCII characters.
// https://webmachinelearning.github.io/webmcp/#tool-definition-name
export const MAX_TOOL_NAME_LENGTH = 128;

export function usage(
  clarity: ClarityApi,
  kind: RecordKind.ToolActivated | RecordKind.ToolCancel,
  name: unknown
): void {
  if (
    typeof name !== "string" ||
    name.length > MAX_TOOL_NAME_LENGTH ||
    name.length === 0
  ) {
    throw new Error("Clarity WebMCP tool name is invalid");
  }

  const id = toolNameIds[name as keyof typeof toolNameIds];

  encode(clarity, kind, typeof id === "number" ? id : name);
}

export function encode(clarity: ClarityApi, ...record: WebMcpRecord): void {
  const timestamp = clarity("time");

  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    throw new Error("Clarity WebMCP clock is unavailable");
  }

  clarity("queue", [timestamp, WEBMCP_EVENT_ID, ...record]);
}
