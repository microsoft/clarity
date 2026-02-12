import { Event, Token } from "@clarity-types/data";
import { BrandAgentClarityEvent } from "../../types/brand-agent";

export default function (event: BrandAgentClarityEvent): void {
  const t = (window as any).clarity("time");
  let tokens: Token[] = [t, Event.BrandAgent];
  tokens.push(event.name);
  if (event.chatMessage) {
    tokens.push(event.chatMessage);
    tokens.push(event.conversationId);
  }

  queueTokens(tokens);
}

function queueTokens(tokens: Token[]) {
  if (typeof window !== "undefined" && (window as any).clarity) {
    (window as any).clarity("queue", tokens);
  }
}
