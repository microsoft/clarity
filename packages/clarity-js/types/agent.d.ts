export const enum Action {
  AgentOnline,
  AgentOffline,
  AgentHidden,
  AgentMaximized,
  AgentMinimized,
  AgentMessage,
  HumanMessage,
}

export const enum AuthorType {
  Agent = "agent",
  Customer = "customer",
}

export const enum Visibility {
  Maximized = "maximized",
  Minimized = "minimized",
  Hidden = "hidden",
}

export const enum Availability {
  Online = "online",
  Offline = "offline",
}

export interface VisibilityEvent {
  visibility: Visibility;
}

export interface AvailabilityEvent {
  availability: Availability;
}

export interface NewEvent {
  author: {
    type: AuthorType;
  };
}
