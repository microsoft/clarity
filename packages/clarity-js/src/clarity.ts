import { Config, Module } from "@clarity-types/core";
import { Constant } from "@clarity-types/data";
import * as core from "@src/core";
import measure from "@src/core/measure";
import * as task from "@src/core/task";
import version from "@src/core/version";
import * as data from "@src/data";
import * as diagnostic from "@src/diagnostic";
import * as interaction from "@src/interaction";
import * as layout from "@src/layout";
import * as performance from "@src/performance";
export { version };
export { consent, event, identify, set, upgrade, metadata } from "@src/data";

const modules: Module[] = [diagnostic, layout, interaction, performance];

export function start(config: Config = null): void {
  // Check that browser supports required APIs and we do not attempt to start Clarity multiple times
  if (core.check()) {
    core.config(config);
    core.start();
    data.start();
    modules.forEach(x => measure(x.start)());
  }
}

// By default Clarity is asynchronous and will yield by looking for requestIdleCallback.
// However, there can still be situations with single page apps where a user action can result
// in the whole DOM being destroyed and reconstructed. While Clarity will perform favorably out of the box,
// we do allow external clients to manually pause Clarity for that short burst of time and minimize
// performance impact even further. For reference, we are talking single digit milliseconds optimization here, not seconds.
export function pause(): void {
  if (core.active()) {
    data.event(Constant.Clarity, Constant.Pause);
    task.pause();
  }
}

// This is how external clients can get out of pause state, and resume Clarity to continue monitoring the page
export function resume(): void {
  if (core.active()) {
    task.resume();
    data.event(Constant.Clarity, Constant.Resume);
  }
}

export function stop(): void {
  if (core.active()) {
    // Stop modules in the reverse order of their initialization
    modules.slice().reverse().forEach(x => measure(x.stop)());
    data.stop();
    core.stop();
  }
}
