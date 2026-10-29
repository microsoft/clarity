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

  let controller: AbortController;

  try {
    controller = new AbortController();
  } catch {
    return;
  }

  let usageCount = 0;

  try {
    clarity("register", stop);

    // Retain the marker after failure/cap; only registered shutdown permits a fresh lifecycle.
    host.__clarityWebMcp = controller;

    const modelContext = (document as Document & { modelContext?: EventTarget }).modelContext;

    if (typeof modelContext?.addEventListener === "function") {
      const measuredObserveUsage = clarity("measure", observeUsage);

      const options = {
        signal: controller.signal
      };

      for (const eventType of [ToolEventName.Activated, ToolEventName.Cancel]) {
        // The draft defines ontoolactivated/ontoolcancel on ModelContext, not window:
        // https://webmachinelearning.github.io/webmcp/#model-context-container
        // Probe each "on" property; window is our legacy fallback when that property is absent.
        // addEventListener below uses the event name without the "on" prefix.
        const eventTarget = `on${eventType}` in modelContext
          ? modelContext
          : window;

        eventTarget.addEventListener(eventType, measuredObserveUsage, options);
      }
    }

    encode(
      clarity,
      RecordKind.Ready,
      modelContext ? ApiStatus.Available : ApiStatus.Unavailable
    );
  } catch {
    controller.abort();
  }

  function observeUsage(event: ToolEvent): void {
    if (controller.signal.aborted || !event.isTrusted) {
      return;
    }

    try {
      const kind = event.type === ToolEventName.Activated
        ? RecordKind.ToolActivated
        : RecordKind.ToolCancel;

      usage(clarity, kind, event.toolName);

      if (++usageCount === MAX_USAGE_EVENTS) {
        controller.abort();

        encode(clarity, RecordKind.UsageCapped);
      }
    } catch {
      controller.abort();
    }
  }

  function stop(): void {
    controller.abort();

    if (host.__clarityWebMcp === controller) {
      delete host.__clarityWebMcp;
    }
  }
}

start();
