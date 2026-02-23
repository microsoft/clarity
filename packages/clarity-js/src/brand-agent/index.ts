import { BrandAgentData } from "../../types/brand-agent";
import encode from "./encode";

const handlers = new Map<string, Set<(e: any) => void>>();

export function start(): void {
  if (!window.BrandAgentClarity) {
    window.BrandAgentClarity = {
      on(name: string, cb: (e: any) => void) {
        if (!handlers.has(name)) { handlers.set(name, new Set()); }
        handlers.get(name)!.add(cb);
      },
      off(name: string, cb: (e: any) => void) {
        handlers.get(name)?.delete(cb);
      },
      emit(name: string, e: any) {
        handlers.get(name)?.forEach((fn: (e: any) => void) => fn(e));
      },
    };
  }

  window.BrandAgentClarity.on("agentEvent", handleAgentEvent);
}

export function stop(): void {
  if (window.BrandAgentClarity) {
    window.BrandAgentClarity.off("agentEvent", handleAgentEvent);
  }
  handlers.clear();
}

function handleAgentEvent(e: BrandAgentData): void {
  encode(e);
}
