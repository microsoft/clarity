import { Event, Token } from "@clarity-types/data";
import { time } from "@src/core/time";
import { data } from "./index";
import { reset } from "./livechat";
import { AgentEvent, AuthorType } from "@clarity-types/agent";

export default function (event: AgentEvent): void {
    const t = time();
    let tokens: Token[] = [t, Event.Agent];
    switch (event) {
       case AgentEvent.AgentOnline:
        case AgentEvent.AgentOffline:
        case AgentEvent.AgentHidden:
        case AgentEvent.AgentMaximized:
        case AgentEvent.AgentMinimized:
            tokens.push(event);
            break;
        case AgentEvent.AgentMessage:
        case AgentEvent.HumanMessage:
            if (data.messages) {
                for (const author of data.messages) {
                    tokens.push(author === AuthorType.Agent ? AgentEvent.AgentMessage : AgentEvent.HumanMessage);
                }
            }
            reset();
            break;
    }
    queueTokens(tokens);
}

function queueTokens(tokens: Token[]) {
  if (typeof window !== "undefined" && (window as any).clarity) {
    (window as any).clarity("queue", tokens);
  }
}
