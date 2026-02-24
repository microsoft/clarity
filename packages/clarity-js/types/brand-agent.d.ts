// This should exactly match with Agent JS.

export enum BrandAgentEventName {
  BubbleShown,
  NudgeClicked,
  AgentMessageSent,
  UserMessageSent,
  ConversationStarted,
}

export interface BrandAgentData {
  name: BrandAgentEventName;
  msg?: string;
  cid?: string;
}
