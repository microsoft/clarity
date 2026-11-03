import { ApiStatus, Host, RecordKind, ToolEvent, ToolEventName } from "./common";
import { encode, MAX_USAGE_EVENTS, usage } from "./encode";

export function start(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const host = window as Host;

  if (host.__clarityWebMcp || typeof host.clarity !== "function") {
    return;
  }

  const clarity = host.clarity;
  const listeners: [EventTarget, ToolEventName][] = [];
  let measuredObserveUsage: ((event: ToolEvent) => void) | undefined;
  let active = true;
  let usageCount = 0;

  try {
    measuredObserveUsage = clarity("measure", observeUsage);
    if (typeof measuredObserveUsage !== "function") { return; }

    clarity("register", stop);

    // Retain the marker after failure/cap; only registered shutdown permits a fresh lifecycle.
    host.__clarityWebMcp = stop;

    const modelContext = (document as Document & { modelContext?: EventTarget }).modelContext;

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
    if (!active || !event.isTrusted) {
      return;
    }

    try {
      const kind = event.type === ToolEventName.Activated
        ? RecordKind.ToolActivated
        : RecordKind.ToolCancel;

      usage(clarity, kind, event.toolName);

      if (++usageCount === MAX_USAGE_EVENTS) {
        cleanup();

        encode(clarity, RecordKind.UsageCapped);
      }
    } catch {
      cleanup();
    }
  }

  function cleanup(): void {
    active = false;
    if (measuredObserveUsage) {
      for (const [target, eventType] of listeners) {
        target.removeEventListener(eventType, measuredObserveUsage);
      }
    }
    listeners.length = 0;
  }

  function stop(): void {
    cleanup();

    if (host.__clarityWebMcp === stop) {
      delete host.__clarityWebMcp;
    }
  }
}

start();
