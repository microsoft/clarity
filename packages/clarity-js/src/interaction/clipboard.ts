import { Event } from "@clarity-types/data";
import { Clipboard, ClipboardState } from "@clarity-types/interaction";
import { FunctionNames } from "@clarity-types/performance";
import { bind } from "@src/core/event";
import { schedule } from "@src/core/task";
import { time } from "@src/core/time";
import encode from "./encode";
import { target } from "@src/layout/target";

export let state: ClipboardState[] = [];

export function start(): void {
    reset();
}

export function observe(root: Node): void {
    bind(root, "cut", recompute.bind(this, Clipboard.Cut), true);
    bind(root, "copy", recompute.bind(this, Clipboard.Copy), true);
    bind(root, "paste", recompute.bind(this, Clipboard.Paste), true);
}

function recompute(action: Clipboard, evt: UIEvent): void {
    state.push({ time: time(evt), event: Event.Clipboard, data: { target: target(evt), action } });
    schedule(encode.bind(this, Event.Clipboard));
}
recompute.dn = FunctionNames.ClipboardRecompute;

export function reset(): void {
    state = [];
}

export function stop(): void {
    reset();
}
