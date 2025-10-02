export const enum AgentEvent {
    AgentOnline,
    AgentOffline,
    AgentHidden,
    AgentMaximized,
    AgentMinimized,
    AgentMessage,
    HumanMessage,
}

export const enum AuthorType {
    Agent,
    Human
}

export interface AgentData {
    messages: AuthorType[];
}

export const enum Visibility {
    Maximized = "maximized",
    Minimized = "minimized",
    Hidden = "hidden"
}

export const enum Availability {
    Online = "online",
    Offline = "offline"
}