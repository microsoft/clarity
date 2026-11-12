import {
  Action,
  Visibility,
  Availability,
  VisibilityEvent,
  AvailabilityEvent,
  NewEvent,
  AuthorType,
} from "@clarity-types/agent";
import encode from "./encode";

function visible(event: VisibilityEvent): void {
  const visibility = event.visibility;
  switch (visibility) {
    case Visibility.Maximized:
      encode(Action.AgentMaximized);
      break;
    case Visibility.Minimized:
      encode(Action.AgentMinimized);
      break;
    case Visibility.Hidden:
      encode(Action.AgentHidden);
      break;
  }
}

function avail(event: AvailabilityEvent): void {
  const isOnline = event.availability === Availability.Online;
  encode(isOnline ? Action.AgentOnline : Action.AgentOffline);
}

function message(event: NewEvent): void {
  if (event.author.type === AuthorType.Agent) {
    encode(Action.AgentMessage);
  } else {
    encode(Action.HumanMessage);
  }
}

export function start(): void {
  if (window.LiveChatWidget) {
    window.LiveChatWidget.on("visibility_changed", visible);
    window.LiveChatWidget.on("new_event", message);
    window.LiveChatWidget.on("availability_changed", avail);
  }
  // Register stop callback with main Clarity
  if (typeof window !== "undefined" && (window as any).clarity) {
    (window as any).clarity("register", stop);
  }
}

export function stop(): void {
  if (window.LiveChatWidget) {
    window.LiveChatWidget.off("visibility_changed", visible);
    window.LiveChatWidget.off("availability_changed", avail);
    window.LiveChatWidget.off("new_event", message);
  }
}
