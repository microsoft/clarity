import { Event, Token } from "@clarity-types/data";
import { data } from "./index";
import { reset } from "./livechat";
import { Action, AuthorType } from "@clarity-types/agent";

export default function (event: Action): void {
    const t = (window as any).clarity("time");
    let tokens: Token[] = [t, Event.Chat];
    switch (event) {
       case Action.AgentOnline:
        case Action.AgentOffline:
        case Action.AgentHidden:
        case Action.AgentMaximized:
        case Action.AgentMinimized:
            tokens.push(event);
            break;
        case Action.AgentMessage:
        case Action.HumanMessage:
            if (data.messages) {
                for (const author of data.messages) {
                    tokens.push(author === AuthorType.Agent ? Action.AgentMessage : Action.HumanMessage);
                }
            }
            reset();
            break;
    }
    console.log("tokens:", tokens);
    queueTokens(tokens);
}

function queueTokens(tokens: Token[]) {
  if (typeof window !== "undefined" && (window as any).clarity) {
    (window as any).clarity("queue", tokens);
  }
}
