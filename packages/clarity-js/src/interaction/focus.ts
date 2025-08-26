import { BooleanFlag, Event } from "@clarity-types/data";
import { FocusData } from "@clarity-types/interaction";
import { bind } from "@src/core/event";
import encode from "./encode";

export let data: FocusData;

export function start(): void {
  bind(window, "focus", () => compute(BooleanFlag.True));
  bind(window, "blur", () => compute(BooleanFlag.False));
}

export function stop(): void {
  reset();
}

export function reset(): void {
  data = null;
}

function compute(focus: BooleanFlag): void {
  data = { focused: focus };

  encode(Event.Focus);
}
