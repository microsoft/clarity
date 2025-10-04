import { Action, Visibility, Availability, VisibilityEvent, AvailabilityEvent, NewEvent } from "@clarity-types/agent";
import encode from "./encode";

function onVisible(event: VisibilityEvent): void {
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

function onAvail(event: AvailabilityEvent): void {
    const isOnline = event.availability === Availability.Online;
    encode(isOnline ? Action.AgentOnline : Action.AgentOffline);
}

function onEvent(event: NewEvent): void {
    if (event.author.type === 'agent') {
        encode(Action.AgentMessage);
    } else {
        encode(Action.HumanMessage);
    }
}

export function start(): void {
    if (window.LiveChatWidget) {
        window.LiveChatWidget.on('visibility_changed', onVisible);
        window.LiveChatWidget.on('new_event', onEvent);
        window.LiveChatWidget.on('availability_changed', onAvail);
    }
    // Register stop callback with main Clarity
    if (typeof window !== "undefined" && (window as any).clarity) {
        (window as any).clarity("register", stop);
    }
}

export function stop(): void {
    if (window.LiveChatWidget) {
        window.LiveChatWidget.off('visibility_changed', onVisible);
        window.LiveChatWidget.off('availability_changed', onAvail);
        window.LiveChatWidget.off('new_event', onEvent);
    }
}