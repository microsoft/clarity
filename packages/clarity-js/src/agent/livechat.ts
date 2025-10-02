import { AuthorType, AgentEvent, Visibility, Availability } from "@clarity-types/agent";
import { data } from "./index";
import encode from "./encode";

function onVisibilityChanged(event: any): void {
    if (data) {
        const visibility = event.visibility;
        switch (visibility) {
            case Visibility.Maximized:
                encode(AgentEvent.AgentMaximized);
                break;
            case Visibility.Minimized:
                encode(AgentEvent.AgentMinimized);
                break;
            case Visibility.Hidden:
                encode(AgentEvent.AgentHidden);
                break;
        }
    }
}

function onAvailability_changed(event: any): void {
    if (data) {
        const isOnline = event.availability === Availability.Online;
        encode(isOnline ? AgentEvent.AgentOnline : AgentEvent.AgentOffline);
    }
}

function onNewEvent(event: any): void {
    if (data) {
        if (event.author.type === 'agent') {
            data.messages.push(AuthorType.Agent);
            encode(AgentEvent.AgentMessage);
        } else {
            data.messages.push(AuthorType.Human);
            encode(AgentEvent.HumanMessage);
        }
    }
}

export function start(): void {
    if (window.LiveChatWidget) {
        window.LiveChatWidget.on('visibility_changed', onVisibilityChanged);
        window.LiveChatWidget.on('new_event', onNewEvent);
        window.LiveChatWidget.on('availability_changed', onAvailability_changed);
    }
}

export function stop(): void {
  reset();
}

export function reset(): void {
    if (data) {
        data.messages = [];
    }
}