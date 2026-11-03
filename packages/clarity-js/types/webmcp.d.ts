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

export type Token = string | number;

export type WebMcpRecord =
  | [kind: RecordKind.Ready, status: ApiStatus]
  | [kind: RecordKind.ToolActivated | RecordKind.ToolCancel, name: string | number]
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

export type ToolEvent = Event & {
  toolName?: unknown;
};

declare global {
  interface Window {
    __clarityWebMcp?: () => void;
  }

  interface Document {
    modelContext?: EventTarget;
  }
}
