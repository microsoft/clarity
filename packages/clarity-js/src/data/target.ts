import { Event, TargetData, TargetInfo } from "@clarity-types/data";
import encode from "@src/data/encode";
import hash from "@src/data/hash";
import { layout } from "@src/layout/boxmodel";
import * as dom from "@src/layout/dom";

let queue: {[key: number]: TargetData} = {};

export function reset(): void {
    queue = {};
}

export function target(evt: UIEvent): Node {
    let path = evt.composed && evt.composedPath ? evt.composedPath() : null;
    return (path && path.length > 0 ? path[0] : evt.target) as Node;
}

export function link(node: Node): HTMLAnchorElement {
    while (node && node !== document) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            let element = node as HTMLElement;
            if (element.tagName === "A") {
                return element as HTMLAnchorElement;
            }
        }
        node = node.parentNode;
    }
    return null;
}

export function track(node: Node): TargetInfo {
    let id = null;
    let selector = null;
    let region = null;
    if (node) {
        let value = dom.get(node);
        if (value !== null) {
            id = value.id;
            selector = value.selector;
            region = value.region;
        }
    }
    return { id, selector, node, region };
}

export function observe(info: TargetInfo): number {
    let value = info.node ? dom.get(info.node) : null;
    let id = info.id === null && value ? value.id : info.id;
    let selector = value && !info.selector ? value.selector : info.selector;
    let region = value && !info.region ? value.region : info.region;

    if (id !== null && !(id in queue)) {
        queue[id] = {
            id,
            hash: selector ? hash(selector) : "",
            box: info.node && info.node.nodeType !== Node.TEXT_NODE ? layout(info.node as Element) : null,
            region: region ? region : null,
        };
    }

    return id;
}

export function updates(): TargetData[] {
    let data: TargetData[] = [];
    for (let id in queue) {
        if (queue[id]) { data.push(queue[id]); }
    }
    reset();
    return data;
}

export function compute(): void {
    encode(Event.Target);
}
