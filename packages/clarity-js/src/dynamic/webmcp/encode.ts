import { ClarityApi, RecordKind, WebMcpRecord } from "@clarity-types/webmcp";

export const WEBMCP_EVENT_ID = 205;
export const MAX_USAGE_EVENTS = 100;

// WebMCP draft requires tool names to be 1-128 ASCII characters.
// https://webmachinelearning.github.io/webmcp/#tool-definition-name
export const MAX_TOOL_NAME_LENGTH = 128;

// Shopify WebMCP reference: https://shopify.dev/docs/api/web-mcp
// Wire IDs are permanent; reserve 0 for unknown and append without renumbering.
const toolNameIds = {
  __proto__: null, // Never resolve inherited names as IDs.
  add_to_cart: 1,
  browse_store: 2,
  cancel_cart: 3,
  get_cart: 4,
  get_product: 5,
  get_ucp_profile: 6,
  manage_orders: 7,
  proceed_to_checkout: 8,
  search_catalog: 9,
  search_shop_policies_and_faqs: 10,
  show_variant: 11,
  update_cart_lines: 12,
} as const;

export function usage(
  clarity: ClarityApi,
  kind: RecordKind.ToolActivated | RecordKind.ToolCancel,
  name: unknown
): boolean {
  if (
    typeof name !== "string" ||
    name.length > MAX_TOOL_NAME_LENGTH ||
    name.length === 0
  ) {
    return false;
  }

  const id = toolNameIds[name as keyof typeof toolNameIds];

  encode(clarity, kind, typeof id === "number" ? id : name);
  return true;
}

export function encode(clarity: ClarityApi, ...record: WebMcpRecord): void {
  const timestamp = clarity("time");

  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    throw new Error("Clarity WebMCP clock is unavailable");
  }

  clarity("queue", [timestamp, WEBMCP_EVENT_ID, ...record]);
}
