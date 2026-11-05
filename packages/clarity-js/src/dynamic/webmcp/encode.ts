import { Event } from "@clarity-types/data";
import { Action, WebMCPToolIds, WebMcpRecord } from "@clarity-types/webmcp";

// WebMCP draft requires tool names to be 1-128 ASCII characters.
// https://webmachinelearning.github.io/webmcp/#tool-definition-name
const MAX_TOOL_NAME_LENGTH = 128;

export function usage(
  action: Action.ToolActivated | Action.ToolCancel,
  name: unknown
): boolean {
  if (
    typeof name !== "string" ||
    name.length > MAX_TOOL_NAME_LENGTH ||
    name.length === 0
  ) {
    return false;
  }

  const id = WebMCPToolIds[name as keyof typeof WebMCPToolIds];

  encode(action, typeof id === "number" ? id : name);
  return true;
}

export function encode(...record: WebMcpRecord): void {
  const t = (window as any).clarity("time");
  (window as any).clarity("queue", [t, Event.WebMcp, ...record]);
}
