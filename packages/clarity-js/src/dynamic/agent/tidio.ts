import { Action } from "@clarity-types/agent";
import encode from "./encode";

let isActive = false;

function open() {
  if (!isActive) return;
  encode(Action.AgentMaximized);
}

function close() {
  if (!isActive) return;
  encode(Action.AgentMinimized);
}

function human() {
  if (!isActive) return;
  encode(Action.HumanMessage);
}

function agent() {
  if (!isActive) return;
  encode(Action.AgentMessage);
}

export function start(): void {
  if (window.tidioChatApi) {
    window.tidioChatApi.on("open", open);
    window.tidioChatApi.on("close", close);
    window.tidioChatApi.on("messageFromVisitor", human);
    window.tidioChatApi.on("messageFromOperator", agent);
    isActive = true;
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
