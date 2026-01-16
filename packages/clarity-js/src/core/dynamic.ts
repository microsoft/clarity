import { Constant as DataConstant } from "@clarity-types/data";
import { Constant } from "@clarity-types/layout";
import config from "@src/core/config";
import { report } from "@src/core/report";
import * as baseline from "@src/data/baseline";

let stopCallbacks: (() => void)[] = [];
let active = false;
let modules: Set<number> = null;

export function start(): void {
  active = true;
  modules = new Set<number>();

  if (config.modules && config.modules.length > 0) {
    config.modules.forEach((m) => { event(m); });
  }
}

export function stop(): void {
  stopCallbacks.reverse().forEach((callback) => {
    try {
      callback();
    } catch (error) {
      // Do nothing
    }
  });
  stopCallbacks = [];
  active = false;
}

export function register(stopCallback: () => void): void {
  if (active && typeof stopCallback === "function") {
    stopCallbacks.push(stopCallback);
  }
}

export function event(signal: string): void {
  if (!active) return;

  const parts = signal ? signal.split(" ") : [Constant.Empty];
  const m = parts.length > 1 ? parseInt(parts[1], 10) : null;
  if (m && modules.has(m)) {
    return;
  }

  load(parts[0], m);
}

function load(url: string, mid: number | null): void {
  try {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => {
      if (mid) {
        modules.add(mid);
        baseline.dynamic(modules);
      }
    };
    script.onerror = () => {
      report(new Error(`${DataConstant.Module}: ${url}`));
    };
    document.head.appendChild(script);
  } catch (error) {
    // Do nothing
  }
}
