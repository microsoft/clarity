import { Constant } from "@clarity-types/data";
import * as clarity from "@src/clarity";

const w = window;
const c = Constant.Clarity;

export function setup() {
    // Start queuing up calls while Clarity is inactive and we are in a browser enviornment
    if (typeof w !== "undefined") {
        w[c] = (...args) => {
            if (!w[c].q) {
                w[c].q = [];
            }
            w[c].q.push(args);
            // if the start function was called, don't queue it and instead process the queue
            args[0] === "start" && w[c].q.unshift(w[c].q.pop()) && process();
        };
    }
}

export function process() {
    if (typeof w !== "undefined") {
        // Do not execute or reset global "clarity" variable if a version of Clarity is already running on the page
        if (w[c]?.v) {
            return console.warn("Error CL001: Multiple Clarity tags detected.");
        }

        // Expose clarity in a browser environment
        // To be efficient about queuing up operations while Clarity is wiring up, we expose clarity.*(args) => clarity(*, args);
        // This allows us to reprocess any calls that we missed once Clarity is available on the page
        // Once Clarity script bundle is loaded on the page, we also initialize a "v" property that holds current version
        // We use the presence or absence of "v" to determine if we are attempting to run a duplicate instance
        const queue = w[c] ? w[c].q || [] : [];
        w[c] = (method: string, ...args): void => clarity[method](...args);
        w[c].v = clarity.version;
        while (queue.length > 0) {
            w[c](...queue.shift());
        }
    }
}
