import { ApiStatus, ClarityApi, RecordKind, ToolEvent, ToolEventName } from "@clarity-types/webmcp";
import { encode, MAX_USAGE_EVENTS, usage } from "./encode";

export function start(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const clarity = (window as Window & { clarity?: ClarityApi }).clarity;

  if (window.__clarityWebMcp || typeof clarity !== "function") {
    return;
  }

  const listeners: [EventTarget, ToolEventName][] = [];
  let measuredObserveUsage: ((event: ToolEvent) => void) | undefined;
  let usageCount = 0;

  try {
    measuredObserveUsage = clarity("measure", observeUsage);
    if (typeof measuredObserveUsage !== "function") { return; }

    clarity("register", stop);

    // Retain the marker after failure/cap; only registered shutdown permits a fresh lifecycle.
    window.__clarityWebMcp = stop;

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

    encode(
      clarity,
      RecordKind.Ready,
      modelContext ? ApiStatus.Available : ApiStatus.Unavailable
    );
  } catch {
    cleanup();
  }

  function observeUsage(event: ToolEvent): void {
    if (!event.isTrusted) {
      return;
    }

    try {
      const kind = event.type === ToolEventName.Activated
        ? RecordKind.ToolActivated
        : RecordKind.ToolCancel;

      if (!usage(clarity, kind, event.toolName)) {
        return;
      }

      if (++usageCount === MAX_USAGE_EVENTS) {
        cleanup();

        encode(clarity, RecordKind.UsageCapped);
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

    if (window.__clarityWebMcp === stop) {
      delete window.__clarityWebMcp;
    }
  }
}

start();
