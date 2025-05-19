import { type BrowserEvent, Constant } from "@clarity-types/core";
import api from "./api";
import measure from "./measure";

let bindings: Map<EventTarget, BrowserEvent[]> = new Map();

export function bind(target: EventTarget, event: string, listener: EventListener, capture = false, passive = true): void {
    // biome-ignore lint/style/noParameterAssign: intentionally reassigning the event listener for caller
    listener = measure(listener) as EventListener;
    // Wrapping following lines inside try / catch to cover edge cases where we might try to access an inaccessible element.
    // E.g. Iframe may start off as same-origin but later turn into cross-origin, and the following lines will throw an exception.
    try {
        target[api(Constant.AddEventListener)](event, listener, { capture, passive });
        if (!has(target)) {
            bindings.set(target, []);
        }

        bindings.get(target).push({ event, listener, options: { capture, passive } });
    } catch {
        /* do nothing */
    }
}

export function reset(): void {
    // Walk through existing list of bindings and remove them all
    bindings.forEach((bindingsPerTarget: BrowserEvent[], target: EventTarget) => {
        resetByTarget(bindingsPerTarget, target);
    });

    bindings = new Map();
}

export function unbind(target: EventTarget) {
    if (!has(target)) {
        return;
    }
    resetByTarget(bindings.get(target), target);
}

export function has(target: EventTarget): boolean {
    return bindings.has(target);
}

function resetByTarget(bindingsPerTarget: BrowserEvent[], target: EventTarget): void {
    for (const binding of bindingsPerTarget) {
        // Wrapping inside try / catch to avoid situations where the element may be destroyed before we get a chance to unbind
        try {
            target[api(Constant.RemoveEventListener)](binding.event, binding.listener, {
                capture: binding.options.capture,
                passive: binding.options.passive,
            });
        } catch {
            /* do nothing */
        }
    }
    bindings.delete(target);
}
