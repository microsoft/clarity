import { BrandAgentData } from "@clarity-types/data";
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

  window.BrandAgentClarity.on("brandAgentEvent", handleBrandAgentEvent);
  
  // Register stop callback with main Clarity
  if (typeof window !== "undefined" && (window as any).clarity) {
    (window as any).clarity("register", stop);
  }
}

export function stop(): void {
  if (window.BrandAgentClarity) {
    window.BrandAgentClarity.off("brandAgentEvent", handleBrandAgentEvent);
  }
  handlers.clear();
}

function handleBrandAgentEvent(e: BrandAgentData): void {
  encode(e);
}
