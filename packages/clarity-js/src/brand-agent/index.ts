import { BrandAgentClarityEvent } from "../../types/brand-agent";
import encode from "./encode";

export function start(): void {
  const handlers = new Map<string, Set<(event: any) => void>>(); // Needed here to store callbacks

  if (!window.BrandAgentClarity) {
    window.BrandAgentClarity = {
      on(eventName: string, callback: (event: any) => void) {
        if (!handlers.has(eventName)) {
          handlers.set(eventName, new Set());
        }
        handlers.get(eventName)!.add(callback);
      },
      off(eventName: string, callback: (event: any) => void) {
        handlers.get(eventName)?.delete(callback);
      },
      emit(eventName: string, event: any) {
        handlers
          .get(eventName)
          ?.forEach((handler: (event: any) => void) => handler(event));
      },
    };
  }

  window.BrandAgentClarity.on("agentEvent", handleAgentEvent);

}

export function stop(): void {
  if (window.BrandAgentClarity) {
    window.BrandAgentClarity.off("agentEvent", handleAgentEvent);
  }
}

function handleAgentEvent(event: BrandAgentClarityEvent): void {
  encode(event);
}
