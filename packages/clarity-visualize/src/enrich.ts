import { helper } from "clarity-js";
import { Layout } from "clarity-decode";
import { NodeData } from "@clarity-types/visualize";

export class EnrichHelper {
        
    children: { [key: number]: number[] };
    nodes: { [key: number]: NodeData };
    
    constructor() {
        this.reset();
    }

    public reset = (): void => {
        this.children = {};
        this.nodes = {};
    }

    public selectors = (event: Layout.DomEvent): Layout.DomEvent => {
        event.data.forEach(d => {
            let parent = this.nodes[d.parent];
            let children = this.children[d.parent] || [];
            let node = this.nodes[d.id] || { tag: d.tag, parent: d.parent, previous: d.previous };
            let attributes = d.attributes || {};

            /* Track parent-child relationship for this element */
            if (node.parent !== d.parent) {
                let childIndex = d.previous === null ? 0 : children.indexOf(d.previous) + 1;
                children.splice(childIndex, 0, d.id);

                // Stop tracking this node from children of previous parent
                if (node.parent !== d.parent) {
                    let exParent = this.children[node.parent];
                    let nodeIndex = exParent ? exParent.indexOf(d.id) : -1;
                    if (nodeIndex >= 0) {
                        this.children[node.parent].splice(nodeIndex, 1);
                    }
                }
                node.parent = d.parent;
            } else if (children.indexOf(d.id) < 0) { children.push(d.id); }

            /* Get current position */
            node.position = this.position(d.id, d.tag, node, children, children.map(c => this.nodes[c]));

            /* For backward compatibility, continue populating current selector and hash like before in addition to beta selector and hash */
            let input: Layout.SelectorInput = { tag: d.tag, prefix: parent ? [parent.stable, parent.beta] : null, position: node.position, attributes };

            // Get stable selector
            // We intentionally use "null" value for empty selectors to keep parity with v0.6.25 and before.
            let selector = helper.selector(input);
            d.selector = selector.length > 0 ? selector : null;
            d.hash = selector.length > 0 ? helper.hash(d.selector) : null;
            
            // Get beta selector
            let selectorBeta = helper.selector(input, true);
            d.selectorBeta = selectorBeta.length > 0 ? selectorBeta : null;
            d.hashBeta = selectorBeta.length > 0 ? helper.hash(d.selectorBeta) : null;

            /* Track state for future reference */
            node.stable = selector;
            node.beta = selectorBeta;
            this.nodes[d.id] = node;
            if (d.parent) { this.children[d.parent] = children; }                             
        });
        return event;
    }
    
    private position = (id: number, tag: string, child: NodeData, children: number[], siblings: NodeData[]): number => {
        child.position = 1;
        let idx = children ? children.indexOf(id) : -1;
        while (idx-- > 0) {
            if (tag === siblings[idx].tag) {
                child.position = siblings[idx].position + 1;
                break;
            }
        }
        return child.position;
    }
}