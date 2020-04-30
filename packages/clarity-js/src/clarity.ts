import { Config } from "@clarity-types/core";
import * as core from "@src/core";
import configuration from "@src/core/config";
import version from "@src/core/version";
import { bind } from "@src/core/event";
import measure from "@src/core/measure";
import * as task from "@src/core/task";
import * as data from "@src/data";
import * as diagnostic from "@src/diagnostic";
import * as interaction from "@src/interaction";
import * as layout from "@src/layout";
import * as performance from "@src/performance";

const CLARITY = "clarity";
export let active = false;
export { version };

export function config(override: Config): boolean {
  // Process custom configuration overrides, if available
  if (active) { return false; }
  for (let key in override) {
      if (key in configuration) { configuration[key] = override[key]; }
  }
  return true;
}

export function start(override: Config = {}): void {
  // Check that browser supports required APIs
  // And, also that we are not attempting to start Clarity multiple times
  if (core.check() && active === false) {
    config(override);
    active = true;

    core.start();
    data.start();
    measure(diagnostic.start)();
    measure(layout.start)();
    measure(interaction.start)();
    measure(performance.start)();
  }
}

function restart(): void {
  start();
  tag(CLARITY, "restart");
}

// Suspend ends the current Clarity instance after a configured timeout period
// The way it differs from the "end" call is that it starts listening to
// user interaction events as soon as it terminates existing clarity instance.
// On the next interaction, it automatically starts another instance under a different page id
// E.g. if configured timeout is 10m, and user stays inactive for an hour.
// In this case, we will suspend clarity after 10m of inactivity and after another 50m when user interacts again
// Clarity will restart and start another instance seamlessly. Effectively not missing any active time, but also
// not holding the session during inactive time periods.
export function suspend(): void {
  tag(CLARITY, "suspend");
  end();
  bind(document, "mousemove", restart);
  bind(document, "touchstart", restart);
  bind(window, "resize", restart);
  bind(window, "scroll", restart);
  bind(window, "pageshow", restart);
}

// By default Clarity is asynchronous and will yield by looking for requestIdleCallback.
// However, there can still be situations with single page apps where a user action can result
// in the whole DOM being destroyed and reconstructed. While Clarity will performan favorably out of the box,
// we do allow external clients to manually pause Clarity for that short burst of time and minimize
// performance impact even further. For reference, we are talking 10s of milliseconds optimization here, not seconds.
export function pause(): void {
  if (active) {
    tag(CLARITY, "pause");
    task.pause();
  }
}

// This is how external clients can get out of pause state, and resume Clarity to continue monitoring the page
export function resume(): void {
  if (active) {
    task.resume();
    tag(CLARITY, "resume");
  }
}

export function end(): void {
  if (active) {
    measure(performance.end)();
    measure(interaction.end)();
    measure(layout.end)();
    measure(diagnostic.end)();
    data.end();
    core.end();
    active = false;
  }
}

export function tag(key: string, value: string): void {
  // Do not process tags if Clarity is not already activated
  if (active) {
    measure(data.tag)(key, value);
  }
}

export function upgrade(key: string): void {
  // Do not process upgrade call if Clarity is not already activated and in lean mode
  if (active && configuration.lean) {
    measure(data.upgrade)(key);
  }
}

export function consent(): void {
  // Do not begin tracking user if Clarity is not already activated
  if (active && !configuration.track) {
    measure(data.consent)();
  }
}
