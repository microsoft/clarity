import { Action } from "@clarity-types/agent";
import encode from "./encode";

// Proxy pattern state to prevent handler conflicts (GitHub issue #979)
const handlerRegistry: { [eventName: string]: Function[] } = {};
let originalPush: Function | null = null;
let isProxyInstalled = false;
// Infinite loop protection
let isProcessing = false;
let callDepth = 0;
const MAX_DEPTH = 10;

function open(): void {
  encode(Action.AgentMaximized);
}

function close(): void {
  encode(Action.AgentMinimized);
}

function human(): void {
  encode(Action.HumanMessage);
}

function agent(): void {
  encode(Action.AgentMessage);
}

/**
 * Installs a proxy to intercept $crisp.push and maintain a registry of all handlers.
 * This prevents handler conflicts when multiple parties (app code, Clarity, etc.)
 * register handlers for the same Crisp events.
 *
 * Includes infinite loop protection via re-entry flag and depth counter to prevent
 * conflicts with other scripts that may also proxy Crisp events.
 *
 * Without this proxy, Crisp's SDK only keeps the last registered handler per event,
 * causing application handlers to be overwritten when Clarity registers its handlers.
 */
function installProxy(): boolean {
  if (isProxyInstalled || !window.$crisp) {
    return false;
  }

  originalPush = window.$crisp.push.bind(window.$crisp);
  const registry = handlerRegistry;

  window.$crisp.push = function(args: [string, string, Function?]): void {
    const [action, eventName, callback] = args;

    // Infinite loop protection: prevent re-entry
    if (isProcessing) {
      // Already processing a call - break potential loop
      if (originalPush) {
        originalPush(args);
      }
      return;
    }

    // Increment depth counter
    callDepth++;

    // Check depth limit
    if (callDepth > MAX_DEPTH) {
      callDepth = 0; // Reset
      if (originalPush) {
        originalPush(args);
      }
      return;
    }

    try {
      isProcessing = true;

      if (action === "on" && callback) {
        // Store all handlers in our registry
        if (!registry[eventName]) {
          registry[eventName] = [];
        }

        // Add to registry if not already present
        if (!registry[eventName].includes(callback)) {
          registry[eventName].push(callback);
        }

        // Create a multiplexer that calls all registered handlers
        const multiplexer = (data?: any): void => {
          for (const handler of registry[eventName]) {
            try {
              handler(data);
            } catch (e) {
              // Silently catch errors to prevent one handler from breaking others
            }
          }
        };

        // Register the multiplexer with Crisp (replaces previous handler)
        originalPush!(["on", eventName, multiplexer]);
      } else if (action === "off" && callback) {
        // Remove from registry
        if (registry[eventName]) {
          const index = registry[eventName].indexOf(callback);
          if (index > -1) {
            registry[eventName].splice(index, 1);
          }
        }

        // Re-register multiplexer with remaining handlers
        if (registry[eventName] && registry[eventName].length > 0) {
          const multiplexer = (data?: any): void => {
            for (const handler of registry[eventName]) {
              try {
                handler(data);
              } catch (e) {
                // Silently catch errors
              }
            }
          };
          originalPush!(["on", eventName, multiplexer]);
        } else {
          // No handlers left, turn off the event
          originalPush!(args);
        }
      } else {
        // Pass through other commands unchanged
        originalPush!(args);
      }
    } finally {
      // Always reset flags, even on error
      isProcessing = false;
      callDepth--;
    }
  } as any;

  isProxyInstalled = true;
  return true;
}

export function start(): void {
  if (window.$crisp) {
    // Install proxy to prevent handler conflicts
    installProxy();

    // Register Clarity's event handlers
    window.$crisp.push(["on", "chat:opened", open]);
    window.$crisp.push(["on", "chat:closed", close]);
    window.$crisp.push(["on", "message:sent", human]);
    window.$crisp.push(["on", "message:received", agent]);
  }
  // Register stop callback with main Clarity
  if (typeof window !== "undefined" && (window as any).clarity) {
    (window as any).clarity("register", stop);
  }
}

export function stop(): void {
  if (window.$crisp) {
    window.$crisp.push(["off", "chat:opened", open]);
    window.$crisp.push(["off", "chat:closed", close]);
    window.$crisp.push(["off", "message:sent", human]);
    window.$crisp.push(["off", "message:received", agent]);
  }
}
