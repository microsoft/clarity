import { BrowserEvent } from "@clarity-types/core";
import measure from "./measure";

let bindings: BrowserEvent[] = [];

export function bind(target: EventTarget, event: string, listener: EventListener, capture: boolean = false): void {
    listener = measure(listener) as EventListener;
    // Wrapping following lines inside try / catch to cover edge cases where we might try to access an inaccessible element.
    // E.g. Iframe may start off as same-origin but later turn into cross-origin, and the following lines will throw an exception.
    try {
      target.addEventListener(event, listener, capture);
      bindings.push({ event, target, listener, capture });
    } catch { /* do nothing */ }
}

export function reset(): void {
  // Walk through existing list of bindings and remove them all
  for (let binding of bindings) {
    // Wrapping inside try / catch to avoid situations where the element may be destroyed before we get a chance to unbind
    try {
      binding.target.removeEventListener(binding.event, binding.listener, binding.capture);
    } catch { /* do nothing */ }
  }
  bindings = [];
}
