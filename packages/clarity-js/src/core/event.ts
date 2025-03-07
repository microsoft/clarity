import { BrowserEvent, Constant } from "@clarity-types/core";
import api from "./api";
import measure from "./measure";

let bindings: BrowserEvent[] = [];

export function bind(target: EventTarget, event: string, listener: EventListener, capture: boolean = false, passive: boolean = true): void {
  listener = measure(listener) as EventListener;
  // Wrapping following lines inside try / catch to cover edge cases where we might try to access an inaccessible element.
  // E.g. Iframe may start off as same-origin but later turn into cross-origin, and the following lines will throw an exception.
  try {
    target[api(Constant.AddEventListener)](event, listener, { capture, passive });
    bindings.push({ event, target, listener, options: { capture, passive } });
  } catch {
    /* do nothing */
  }
}

export function reset(): void {
  // Walk through existing list of bindings and remove them all
  for (let binding of bindings) {
    // Wrapping inside try / catch to avoid situations where the element may be destroyed before we get a chance to unbind
    try {
      binding.target[api(Constant.RemoveEventListener)](binding.event, binding.listener, { capture: binding.options.capture, passive: binding.options.passive });
    } catch {
      /* do nothing */
    }
  }
  bindings = [];
}
