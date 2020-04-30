import * as connection from "@src/performance/connection";
import * as contentful from "@src/performance/contentfulPaint";
import * as longtask from "@src/performance/longtask";
import * as memory from "@src/performance/memory";
import * as navigation from "@src/performance/navigation";
import * as network from "@src/performance/network";
import * as observer from "@src/performance/observer";
import * as paint from "@src/performance/paint";

export function start(): void {
    contentful.reset();
    longtask.reset();
    memory.reset();
    navigation.reset();
    network.reset();
    paint.reset();
    connection.start();
    observer.start();
}

export function end(): void {
    observer.end();
    connection.end();
    contentful.reset();
    longtask.reset();
    memory.reset();
    navigation.reset();
    network.reset();
    paint.reset();
}

export function compute(): void {
    observer.compute();
    memory.compute();
}
