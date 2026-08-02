import { BrandAgentEvent } from "@clarity-types/agent";
import encode from "./encode";

const eventName = "brandAgentEvent";

function handle(event: BrandAgentEvent): void {
  if (event === null || event === undefined) { return; }
  encode(event.action, event.cid, true);
}

export function start(): void {
  if (!window.BrandAgentClarity) {
    const handlers = new Map<string, Set<(e: any) => void>>();
    window.BrandAgentClarity = {
      on(name: string, cb: (e: any) => void): void {
        if (!handlers.has(name)) { handlers.set(name, new Set()); }
        handlers.get(name).add(cb);
      },
      off(name: string, cb: (e: any) => void): void {
        const set = handlers.get(name);
        if (set) { set.delete(cb); }
      },
      emit(name: string, e: any): void {
        const set = handlers.get(name);
        if (set) { set.forEach((fn: (e: any) => void) => fn(e)); }
      },
    };
  }
  window.BrandAgentClarity.on(eventName, handle);

  if (typeof window !== "undefined" && (window as any).clarity) {
    (window as any).clarity("register", stop);
  }
}

export function stop(): void {
  if (window.BrandAgentClarity) {
    window.BrandAgentClarity.off(eventName, handle);
  }
}
