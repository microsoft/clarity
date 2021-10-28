import { Privacy } from "@clarity-types/core";
import { Event } from "@clarity-types/data";
import { TargetMetadata } from "@clarity-types/layout";
import { track } from "@src/layout/region";
import * as dom from "@src/layout/dom";
import * as mutation from "@src/layout/mutation";

export function target(evt: UIEvent): Node {
    let path = evt.composed && evt.composedPath ? evt.composedPath() : null;
    let node = (path && path.length > 0 ? path[0] : evt.target) as Node;
    mutation.active(); // Mark active periods of time so mutations can continue uninterrupted
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

export function metadata(node: Node, event: Event): TargetMetadata {
    // If the node is null, we return a reserved value for id: 0. Valid assignment of id begins from 1+.
    let output: TargetMetadata = { id: 0, hash: null, privacy: Privacy.Text, node };
    if (node) {
        let value = dom.get(node);
        if (value !== null) {
            output.id = value.id;
            output.hash = value.hash;
            output.privacy = value.metadata.privacy;
            if (value.region) { track(value.region, event); }
        }
    }

    return output;
}
