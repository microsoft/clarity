import { BooleanFlag, Event } from "@clarity-types/data";
import { ConnectionData, NavigatorConnection } from "@clarity-types/performance";
import encode from "@src/performance/encode";

// Reference: https://wicg.github.io/netinfo/
export let data: ConnectionData;

export function start(): void {
    // Check if the client supports Navigator.Connection: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/connection
    // This is an experimental API so we go a bit deeper in our check and ensure that values returned are valid
    if (navigator &&
        "connection" in navigator &&
        "downlink" in navigator["connection"] &&
        typeof navigator["connection"]["downlink"] === "number") {
        (navigator["connection"] as NavigatorConnection).addEventListener("change", recompute);
        recompute();
    }
}

function recompute(): void {
    let connection = navigator["connection"] as NavigatorConnection;
    data = {
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData ? BooleanFlag.True : BooleanFlag.False,
        type: connection.effectiveType
    };
    encode(Event.Connection);
}

export function reset(): void {
    data = null;
}

export function end(): void {
    reset();
}
