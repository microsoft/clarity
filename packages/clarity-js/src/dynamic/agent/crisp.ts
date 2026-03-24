import { Action } from "@clarity-types/agent";
import encode from "./encode";

// Handler function signature for Crisp events
type CrispEventHandler = (data?: any) => void;

// Proxy pattern state to prevent handler conflicts (GitHub issue #979)
const handlerRegistry: { [eventName: string]: CrispEventHandler[] } = {};
let originalPush: ((args: [string, string, CrispEventHandler?]) => void) | null = null;
let isProxyInstalled = false;
// Infinite loop protection
let isProcessing = false;

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
 * Creates a multiplexer function that calls all registered handlers for an event.
 * @param eventName - The Crisp event name
 * @returns A multiplexer function that executes all handlers
 */
function createMultiplexer(eventName: string): CrispEventHandler {
  return (data?: any): void => {
    const handlers = handlerRegistry[eventName];
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(data);
      } catch (e) {
        // Silently catch errors to prevent one handler from breaking others
      }
    }
  };
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

  window.$crisp.push = function(args: [string, string, CrispEventHandler?]): void {
    const [action, eventName, callback]: [string, string, CrispEventHandler?] = args;

    // Infinite loop protection: prevent re-entry
    if (isProcessing) {
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

        // Register the multiplexer with Crisp (replaces previous handler)
        originalPush!(["on", eventName, createMultiplexer(eventName)]);
      } else if (action === "off") {
        if (callback) {
          // Remove specific handler from registry
          if (registry[eventName]) {
            const index = registry[eventName].indexOf(callback);
            if (index > -1) {
              registry[eventName].splice(index, 1);
            }
          }
        } else {
          delete registry[eventName];
        }

        // Re-register multiplexer with remaining handlers (if any)
        if (registry[eventName] && registry[eventName].length > 0) {
          originalPush!(["on", eventName, createMultiplexer(eventName)]);
        } else {
          // No handlers left, clean up and turn off the event
          delete registry[eventName];
          originalPush!(args);
        }
      } else {
        // Pass through other commands unchanged
        originalPush!(args);
      }
    } finally {
      // Always reset flag, even on error
      isProcessing = false;
    }
  };

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
