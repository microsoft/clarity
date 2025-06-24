import { Constant, Event, Setting } from "@clarity-types/data";
import { ChangeState } from "@clarity-types/interaction";
import { FunctionNames } from "@clarity-types/performance";
import config from "@src/core/config";
import { bind } from "@src/core/event";
import hash from "@src/core/hash";
import { schedule } from "@src/core/task";
import { time } from "@src/core/time";
import { target } from "@src/layout/target";
import encode from "./encode";
import { Mask } from "@clarity-types/layout";

export let state: ChangeState[] = [];

export function start(): void {
    reset();
}

export function observe(root: Node): void {
    bind(root, "change", recompute, true);
}

function recompute(evt: UIEvent): void {
    recompute.dn = FunctionNames.ChangeRecompute;
    let element = target(evt) as HTMLInputElement;
    if (element) {
        let value = element.value;
        let checksum = value && value.length >= Setting.WordLength && config.fraud && Mask.Exclude.indexOf(element.type) === -1 ? hash(value, Setting.ChecksumPrecision) : Constant.Empty;
        state.push({ time: time(evt), event: Event.Change, data: { target: target(evt), type: element.type, value, checksum } });
        schedule(encode.bind(this, Event.Change));
    }    
}

export function reset(): void {
    state = [];
}

export function stop(): void {
    reset();
}
