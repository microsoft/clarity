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
            let usePosition = ["DIV", "TR", "P", "LI", "UL", "A", "BUTTON"].indexOf(d.tag) >= 0 || !(Layout.Constant.Class in attributes);

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
            d.selector = helper.selector(d.tag, parent ? parent.stable : null, attributes, usePosition ? node.position : null);
            d.selectorBeta = helper.selector(d.tag, parent ? parent.beta : null, attributes, node.position, true);
            d.hash = helper.hash(d.selector);
            d.hashBeta = helper.hash(d.selectorBeta);

            /* Track state for future reference */
            node.stable = d.selector;
            node.beta = d.selectorBeta;
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