export const enum ToolEventName {
  Activated = "toolactivated",
  Cancel = "toolcancel",
}

export const enum Action {
  ToolActivated = 1,
  ToolCancel = 2,
  UsageCapped = 3,
}

export type Token = string | number;

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
