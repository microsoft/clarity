import { LayoutHash, NodeValue } from "@clarity-types/layout";
import * as dom from "@src/layout/dom";

let allowedAttributes = ['class', 'style', 'visibile', 'hidden', 'width', 'height'];
let hashedAttributes = ['class', 'style'];
let blockedNodeTypes = ['SCRIPT', 'IFRAME', 'HEAD', 'META'];

let styleHashesMap = new Map();
let layoutHashesMap = new Map();
let alphaHashesMap = new Map();
let betaHashesMap = new Map();
let hiddenNodeList = new Set();

export function start(): void {
    reset();
}

export function stop(): void {
    reset();
}

export function trackMutation(mutation: MutationRecord): void {
    // Only listen to attribute mutations
    if (mutation.type === "attributes") {

        // Get node details
        const id = dom.getId(mutation.target, false);
        let nodeValue = dom.getValue(id);
        if (!nodeValue || !nodeValue.hash || !nodeValue.hash[0] || !nodeValue.hash[1]) {
            return;
        }

        // Verify that attribute value changed, as sometimes mutations are triggered with no attribute changes due to modifiers
        let oldAttributeValue = mutation.oldValue;
        let newAttributeValue = (mutation.target as Element).getAttribute(mutation.attributeName);
        if (oldAttributeValue == newAttributeValue) {
            return;
        }

        // If value of any attribute that can affect visuals changes, recompute layout hashes for element and subtree
        if (allowedAttributes.includes(mutation.attributeName)) {
            layoutHash(mutation.target, id);
            recomputeSubtreeLayoutHash(id);

            // If change is in attributes we should hash for style, then compute and apply delta hash
            if (hashedAttributes.includes(mutation.attributeName)) {
                let hashedAttributeDelta = cyrb53(newAttributeValue) ^ cyrb53(oldAttributeValue);
                styleHashesMap.set(id, styleHashesMap.get(id) ^ hashedAttributeDelta);

                // Retrack alpha & beta hashes as changes to classes may cause them to recompute
                alphaHashesMap.set(id, cyrb53(nodeValue.hash[0]));
                betaHashesMap.set(id, cyrb53(nodeValue.hash[1]));
            }
        }

        /// TODO: Check if mutations happen to inline css style elements.
    }
}

export function trackNode(nodeMetadata: NodeValue, node: Node): void {
    // Filter out nodes that dont have necessary metadata, or are pseudo-elements
    if (!nodeMetadata ||
        !nodeMetadata.hash ||
        !nodeMetadata.hash[0] ||
        !nodeMetadata.hash[1] ||
        !nodeMetadata.data ||
        !nodeMetadata.data.tag ||
        blockedNodeTypes.includes(nodeMetadata.data.tag) ||
        nodeMetadata.data.tag.startsWith('*') ||
        nodeMetadata.data.tag.includes(':')) {
        return;
    }

    // Track node hashes alpha & beta
    let id = nodeMetadata.id;
    alphaHashesMap.set(id, cyrb53(nodeMetadata.hash[0]));
    betaHashesMap.set(id, cyrb53(nodeMetadata.hash[1]));

    // Compute node layout hash. Not required to compute for subtree, as this function will be called per node
    layoutHash(node, id);

    // Compute style hash for node
    let styleHash = 0
    for (let attributeName of hashedAttributes) {
        let attributeValue = null;
        if (nodeMetadata.data.attributes && nodeMetadata.data.attributes[attributeName]) {
            attributeValue = nodeMetadata.data.attributes[attributeName];
        }
        styleHash ^= cyrb53(attributeValue);
    }
    styleHashesMap.set(id, styleHash);
}

export function untrackNode(nodeMetadata: NodeValue): void {
    if (!nodeMetadata || !nodeMetadata.id) {
        return;
    }

    // Remove all references to the node
    const id = nodeMetadata.id;
    hiddenNodeList.delete(id)
    layoutHashesMap.delete(id);
    styleHashesMap.delete(id);
    alphaHashesMap.delete(id);
    betaHashesMap.delete(id);
}

export function getCurrentHashes(): LayoutHash {
    let layoutHash: LayoutHash = {
        styleHash: combineHash(styleHashesMap),
        layoutHash: combineHash(layoutHashesMap),
        alphaHash: combineHash(alphaHashesMap),
        betaHash: combineHash(betaHashesMap)
    };

    return layoutHash;
}

function combineHash(hashMap: Map<number, number>): number {
    let combinedHash = 0;
    for (var el of hashMap) {
        if (hiddenNodeList.has(el[0])) {
            continue;
        }
        combinedHash ^= el[1];
    }

    return combinedHash;
}

function recomputeSubtreeLayoutHash(id: number): void {
    let nodeValue = dom.getValue(id);
    for (let child of nodeValue.children) {
        // This method is intended for recomputing already captured elements
        // It should not capture new elements
        if (!layoutHashesMap.has(child)) {
            continue;
        }

        let childNode = dom.getNode(child);
        layoutHash(childNode, child);
        recomputeSubtreeLayoutHash(child);
    }
}

function layoutHash(node: Node, id: number): void {
    let currentWidth = (node as HTMLElement).offsetWidth;
    let currentHeight = (node as HTMLElement).offsetHeight;
    let isHidden = !currentHeight || !currentWidth || currentWidth == 0 || currentHeight == 0;

    if (isHidden) {
        hiddenNodeList.add(id);
        layoutHashesMap.set(id, 0);
    } else {
        let layoutHash = cyrb53(currentWidth.toString()) ^ cyrb53(currentHeight.toString());
        layoutHashesMap.set(id, layoutHash);

        hiddenNodeList.delete(id);
    }
}

function reset(): void {
    styleHashesMap = new Map();
    layoutHashesMap = new Map();
    alphaHashesMap = new Map();
    betaHashesMap = new Map();
    hiddenNodeList = new Set();
}

// Public domain 53 bit hash function
// https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
const cyrb53 = (str: string, seed = 0) => {
    if (str == null) {
        return 0;
    }

    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};
