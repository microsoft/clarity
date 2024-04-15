import { OffsetDistance, Privacy } from "@clarity-types/core";
import { Event } from "@clarity-types/data";
import { Constant, NodeInfo, NodeValue, TargetMetadata } from "@clarity-types/layout";
import * as doc from "@src/layout/document";
import encode from "@src/insight/encode";
import * as interaction from "@src/interaction";
export let values: NodeValue[] = [];
let index: number = 1;
let idMap: WeakMap<Node, number> = null; // Maps node => id.

export function start(): void {
    reset();
    doc.start();
    getId(document.documentElement); // Pre-discover ID for page root
    interaction.observe(document);
}

export function stop(): void {
    reset();
    doc.stop();
}

export function compute(): void { /* Intentionally Blank */ }
export function iframe(): boolean { return false; }
export function offset(): OffsetDistance { return { x: 0, y: 0 }; }
export function hashText(): void { /* Intentionally Blank */ }

export function target(evt: UIEvent): Node {
    let path = evt.composed && evt.composedPath ? evt.composedPath() : null;
    let node = (path && path.length > 0 ? path[0] : evt.target) as Node;
    return node.nodeType === Node.DOCUMENT_NODE ? (node as Document).documentElement : node;
}

export function metadata(node: Node): TargetMetadata {
    let output: TargetMetadata = { id: 0, hash: null, privacy: Privacy.Snapshot, node };
    if (node) { output.id = idMap.has(node) ? idMap.get(node) : getId(node); }
    return output;
}

export function snapshot(): void {    
    values = [];
    traverse(document);
    encode(Event.Snapshot);
}

function reset(): void {
    idMap = new WeakMap();
}

function traverse(root: Node): void {
    let queue = [root];
    while (queue.length > 0) {
        let attributes = null, tag = null, value = null;
        let node = queue.shift();
        let next = node.firstChild;
        let parent = node.parentElement ? node.parentElement : (node.parentNode ?  node.parentNode : null);

        while (next) {
            queue.push(next);
            next = next.nextSibling;
        }
      
        // Process the node
        let type = node.nodeType;
        switch (type) {
            case Node.DOCUMENT_TYPE_NODE:
                let doctype = node as DocumentType;
                tag = Constant.DocumentTag;
                attributes = { name: doctype.name, publicId: doctype.publicId, systemId: doctype.systemId }
                break;
            case Node.TEXT_NODE: 
                value = node.nodeValue;
                tag = idMap.get(parent) ? Constant.TextTag : tag;
                break;
            case Node.ELEMENT_NODE:
                let element = node as HTMLElement;
                attributes = getAttributes(element);
                tag = ["NOSCRIPT", "SCRIPT", "STYLE"].indexOf(element.tagName) < 0 ? element.tagName : tag;
                break;
        }
        add(node, parent, { tag, attributes, value });     
    }
}

/* Helper Functions - Snapshot Traversal */
function getAttributes(element: HTMLElement): { [key: string]: string } {
    let output = {};
    let attributes = element.attributes;
    if (attributes && attributes.length > 0) {
        for (let i = 0; i < attributes.length; i++) {            
            output[attributes[i].name] = attributes[i].value;
        }
    }
    return output;
}

function getId(node: Node): number {
    if (node === null) { return null; }
    if (idMap.has(node)) { return idMap.get(node); }
    idMap.set(node, index);
    return index++;
}

function add(node: Node, parent: Node, data: NodeInfo): void {
    if (node && data && data.tag) {
        let id = getId(node);
        let parentId = parent ? idMap.get(parent) : null;
        let previous = node.previousSibling ? idMap.get(node.previousSibling) : null;
        let metadata = { active: true, suspend: false, privacy: Privacy.Snapshot, position: null, fraud: null, size: null };
        values.push({ id, parent: parentId, previous, children: [], data, selector: null, hash: null, region: null, metadata });
    }
}

export function get(_node: Node): NodeValue {return null;}