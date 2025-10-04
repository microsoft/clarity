import { Event, Token } from "@clarity-types/data";
import { Action } from "@clarity-types/agent";

export default function (event: Action): void {
  const t = (window as any).clarity("time");
  let tokens: Token[] = [t, Event.Chat];
  switch (event) {
    case Action.AgentOnline:
    case Action.AgentOffline:
    case Action.AgentHidden:
    case Action.AgentMaximized:
    case Action.AgentMinimized:
    case Action.AgentMessage:
    case Action.HumanMessage:
      tokens.push(event);
      break;
  }
  queueTokens(tokens);
}

function queueTokens(tokens: Token[]) {
  if (typeof window !== "undefined" && (window as any).clarity) {
    (window as any).clarity("queue", tokens);
  }
}
