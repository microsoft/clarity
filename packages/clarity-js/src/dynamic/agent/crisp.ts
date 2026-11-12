import { Action } from "@clarity-types/agent";
import encode from "./encode";

function open() {
  encode(Action.AgentMaximized);
}

function close() {
  encode(Action.AgentMinimized);
}

function human() {
  encode(Action.HumanMessage);
}

function agent() {
  encode(Action.AgentMessage);
}

export function start(): void {
  if (window.$crisp) {
    window.$crisp.push(["on", "chat:opened", open]);
    window.$crisp.push(["on", "chat:closed", close]);
    window.$crisp.push(["on", "message:sent", human]);
    window.$crisp.push(["on", "message:received", agent]);
  }
  // Register stop callback with main Clarity
  if (typeof window !== "undefined" && (window as any).clarity) {
    (window as any).clarity("register", stop);
  }
}

export function stop(): void {
  if (window.$crisp) {
    window.$crisp.push(["off", "chat:opened", open]);
    window.$crisp.push(["off", "chat:closed", close]);
    window.$crisp.push(["off", "message:sent", human]);
    window.$crisp.push(["off", "message:received", agent]);
  }
}
