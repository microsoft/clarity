// This should exactly match with Agent JS.

export enum BrandAgentEventName {
  BubbleShown = "BubbleShown",
  NudgeClicked = "NudgeClicked",
  AgentMessageSent = "AgentMessageSent",
  UserMessageSent = "UserMessageSent",
  ConversationStarted = "ConversationStarted",
}

export interface BrandAgentData {
  name: BrandAgentEventName;
  msg?: string;
  cid?: string;
}
