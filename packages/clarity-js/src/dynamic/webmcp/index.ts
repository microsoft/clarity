import { Action, ToolEvent, ToolEventName } from "@clarity-types/webmcp";
import { encode, usage } from "./encode";

const MAX_USAGE_EVENTS = 100;
let initialized = false;

export function start(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const clarity = (window as any).clarity;

  if (initialized || typeof clarity !== "function") {
    return;
  }

  const listeners: [EventTarget, ToolEventName][] = [];
  let measuredObserveUsage: ((event: ToolEvent) => void) | undefined;
  let usageCount = 0;

  try {
    measuredObserveUsage = clarity("measure", observeUsage);
    if (typeof measuredObserveUsage !== "function") { return; }

    clarity("register", stop);
    initialized = true;

    const modelContext = document.modelContext;

    if (typeof modelContext?.addEventListener === "function") {
      for (const eventType of [ToolEventName.Activated, ToolEventName.Cancel]) {
        // The draft defines ontoolactivated/ontoolcancel on ModelContext, not window:
        // https://webmachinelearning.github.io/webmcp/#model-context-container
        // Probe each "on" property; window is our legacy fallback when that property is absent.
        // addEventListener below uses the event name without the "on" prefix.
        const eventTarget = `on${eventType}` in modelContext
          ? modelContext
          : window;

        eventTarget.addEventListener(eventType, measuredObserveUsage);
        listeners.push([eventTarget, eventType]);
      }
    }
  } catch {
    cleanup();
  }

  function observeUsage(event: ToolEvent): void {
    try {
      const action = event.type === ToolEventName.Activated
        ? Action.ToolActivated
        : Action.ToolCancel;

      if (!usage(action, event.toolName)) {
        return;
      }

      if (++usageCount === MAX_USAGE_EVENTS) {
        cleanup();

        encode(Action.UsageCapped);
      }
    } catch {
      cleanup();
    }
  }

  function cleanup(): void {
    if (measuredObserveUsage) {
      for (const [target, eventType] of listeners) {
        target.removeEventListener(eventType, measuredObserveUsage);
      }
    }
    listeners.length = 0;
  }

  function stop(): void {
    cleanup();
    initialized = false;
  }
}

start();
