import * as connection from "@src/performance/connection";
import * as navigation from "@src/performance/navigation";
import * as observer from "@src/performance/observer";

export function start(): void {
    navigation.reset();
    connection.start();
    observer.start();
}

export function end(): void {
    observer.end();
    connection.end();
    navigation.reset();
}
