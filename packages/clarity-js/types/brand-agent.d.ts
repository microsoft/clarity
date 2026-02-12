// This should exactly match with Agent JS.

export enum BrandAgentClarityEventName {
  BubbleShown = "BubbleShown",
  NudgeClicked = "NudgeClicked",
  AgentMessageSent = "AgentMessageSent",
  UserMessageSent = "UserMessageSent",
  ConversationStarted = "ConversationStarted",
}

export interface BrandAgentClarityEvent {
  name: BrandAgentClarityEventName;
  chatMessage?: string;
  conversationId?: string;
}
