import { Action } from "@clarity-types/agent";
import encode from "./encode";

let isActive = true;

function onOpen() {
  if (!isActive) return;
  encode(Action.AgentMaximized);
}

function onClose() {
  if (!isActive) return;
  encode(Action.AgentMinimized);
}

function onMessageFromVisitor() {
  if (!isActive) return;
  encode(Action.HumanMessage);
}

function onMessageFromOperator() {
  if (!isActive) return;
  encode(Action.AgentMessage);
}

export function start(): void {
  if (window.tidioChatApi) {
    window.tidioChatApi.on("open", onOpen);
    window.tidioChatApi.on("close", onClose);
    window.tidioChatApi.on("messageFromVisitor", onMessageFromVisitor);
    window.tidioChatApi.on("messageFromOperator", onMessageFromOperator);
  }
  // Register stop callback with main Clarity
  if (typeof window !== "undefined" && (window as any).clarity) {
    (window as any).clarity("register", stop);
  }
}

export function stop(): void {
  if (window.tidioChatApi) {
    isActive = false;
  }
}
