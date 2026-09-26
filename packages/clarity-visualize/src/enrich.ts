import { helper, Layout } from "clarity-js";
import { Layout as DecodedLayout } from "clarity-decode";
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
        helper.selector.reset();
    }

    public selectors = (event: DecodedLayout.DomEvent): DecodedLayout.DomEvent => {
        event.data.forEach && event.data.forEach(d => {
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

            let prefix: [string, string] = parent ? [null, parent.beta] : null;
            let input: Layout.SelectorInput = { id: d.id, tag: d.tag, prefix, position: node.position, attributes };
            let selectorBeta = helper.selector.get(input, Layout.Selector.Beta);
            d.selectorBeta = selectorBeta.length > 0 ? selectorBeta : null;
            d.hashBeta = selectorBeta.length > 0 ? helper.hash(d.selectorBeta) : null;

            /* Track state for future reference */
            node.alpha = null;
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