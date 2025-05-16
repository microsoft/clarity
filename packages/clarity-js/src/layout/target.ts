import { Privacy } from "@clarity-types/core";
import type { Event } from "@clarity-types/data";
import type { TargetMetadata } from "@clarity-types/layout";
import * as fraud from "@src/diagnostic/fraud";
import * as dom from "@src/layout/dom";
import * as mutation from "@src/layout/mutation";
import * as region from "@src/layout/region";

export function target(evt: UIEvent): Node {
    const path = evt.composed && evt.composedPath ? evt.composedPath() : null;
    const node = (path && path.length > 0 ? path[0] : evt.target) as Node;
    mutation.active(); // Mark active periods of time so mutations can continue uninterrupted
    return node && node.nodeType === Node.DOCUMENT_NODE ? (node as Document).documentElement : node;
}

export function metadata(node: Node, event: Event, text: string = null): TargetMetadata {
    // If the node is null, we return a reserved value for id: 0. Valid assignment of id begins from 1+.
    const output: TargetMetadata = { id: 0, hash: null, privacy: Privacy.Text };
    if (node) {
        const value = dom.get(node);
        if (value !== null) {
            const metadata = value.metadata;
            output.id = value.id;
            output.hash = value.hash;
            output.privacy = metadata.privacy;
            if (value.region) {
                region.track(value.region, event);
            }
            if (metadata.fraud) {
                fraud.check(metadata.fraud, value.id, text || value.data.value);
            }
        }
    }

    return output;
}
