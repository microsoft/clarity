import { TargetMetadata } from "@clarity-types/data";
import hash from "@src/data/hash";
import { track } from "@src/layout/region";
import * as dom from "@src/layout/dom";

export function target(evt: UIEvent): Node {
    let path = evt.composed && evt.composedPath ? evt.composedPath() : null;
    let node = (path && path.length > 0 ? path[0] : evt.target) as Node;
    return node.nodeType === Node.DOCUMENT_NODE ? (node as Document).documentElement : node;
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

export function metadata(node: Node, trackRegion?: boolean): TargetMetadata {
    // If the node is null, we return a reserved value for id: 0. Valid assignment of id begins from 1+.
    let output: TargetMetadata = { id: 0, region: null, hash: null, node };
    if (node) {
        let value = dom.get(node);
        if (value !== null) {
            output.id = value.id;
            output.region = value.region;
            output.hash = value.selector ? hash(value.selector) : null;
            if (trackRegion && value.region) {
                track(value.region)
            }
        }
    }

    return output;
}
