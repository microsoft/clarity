export const enum ToolEventName {
  Activated = "toolactivated",
  Cancel = "toolcancel",
}

export const enum Action {
  ToolActivated = 1,
  ToolCancel = 2,
  UsageCapped = 3,
}

// Shopify WebMCP reference: https://shopify.dev/docs/api/web-mcp
// Wire IDs are permanent; reserve 0 for unknown and append without renumbering.
export const toolNameIds = {
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

export interface WebMcpData {
  action: Action;
  name: string | number | null;
}

export type WebMcpRecord =
  | [action: Action.ToolActivated | Action.ToolCancel, name: string | number]
  | [action: Action.UsageCapped];

export type ToolEvent = Event & {
  toolName?: unknown;
};

declare global {
  interface Document {
    modelContext?: EventTarget;
  }
}
