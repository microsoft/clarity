export const enum ToolEventName {
  Activated = "toolactivated",
  Cancel = "toolcancel",
}

export const enum RecordKind {
  Ready = 1,
  ToolActivated = 2,
  ToolCancel = 3,
  UsageCapped = 4,
}

export const enum ApiStatus {
  Unavailable = 1,
  Available = 2,
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

export type ToolNameId = Exclude<typeof toolNameIds[keyof typeof toolNameIds], null> | 0;

export type Token = string | number;

export type WebMcpRecord =
  | [kind: RecordKind.Ready, status: ApiStatus]
  | [kind: RecordKind.ToolActivated | RecordKind.ToolCancel, name: string | ToolNameId]
  | [kind: RecordKind.UsageCapped];

export interface ClarityApi {
  (command: "time"): number;

  (command: "queue", tokens: Token[]): void;

  (command: "register", stop: () => void): void;

  <T extends unknown[]>(
    command: "measure",
    callback: (...args: T) => void
  ): (...args: T) => void;
}

export type Host = Window & {
  clarity?: ClarityApi;
  __clarityWebMcp?: AbortController;
};

export type ToolEvent = Event & {
  toolName?: unknown;
};
