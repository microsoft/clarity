import { Constant, NodeChange, NodeInfo, NodeValue, Source } from "@clarity-types/layout";
import config from "@src/core/config";
import { time } from "@src/core/time";
import selector from "@src/layout/selector";

let index: number = 1;

// Reference: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Input#%3Cinput%3E_types
const DISALLOWED_TYPES = ["password", "hidden", "email", "tel"];
const DISALLOWED_NAMES = ["address", "cell", "code", "dob", "email", "mobile", "name", "phone", "secret", "social", "ssn", "tel", "zip"];

let nodes: Node[] = [];
let values: NodeValue[] = [];
let changes: NodeChange[][] = [];
let updateMap: number[] = [];
let selectorMap: number[] = [];

// The WeakMap object is a collection of key/value pairs in which the keys are weakly referenced
let idMap: WeakMap<Node, number> = null; // Maps node => id.
let regionMap: WeakMap<Node, string> = null; // Maps region nodes => region name
let iframeMap: WeakMap<Document, HTMLIFrameElement> = null; // Maps iframe's contentDocument => parent iframe element

let regionTracker: { [name: string]: number } = {};
let urlMap: { [url: string]: number } = {};

export function start(): void {
    reset();
    extractRegions(document);
}

export function end(): void {
    reset();
}

function reset(): void {
    index = 1;
    nodes = [];
    values = [];
    updateMap = [];
    changes = [];
    selectorMap = [];
    urlMap = {};
    idMap = new WeakMap();
    regionMap = new WeakMap();
    iframeMap = new WeakMap();
    if (Constant.DEVTOOLS_HOOK in window) { window[Constant.DEVTOOLS_HOOK] = { get, getNode, history }; }
}

export function extractRegions(root: ParentNode): void {
    for (let key in config.regions) {
        // We check for regions in the beginning (document) and later whenever there are new additions or modifications to DOM (mutations)
        // Since mutations may happen on leaf nodes too, e.g. textnodes, which may not support all selector APIs.
        // We ensure that the root note supports querySelectorAll API before executing the code below to identify new regions.
        if (config.regions[key] && "querySelectorAll" in root) {
            let elements = root.querySelectorAll(config.regions[key]);
            let length = elements.length;
            for (let i = 0; i < length; i++) {
                if (!(key in regionTracker)) { regionTracker[key] = 0; }
                regionTracker[key]++;
                regionMap.set(elements[i], length > 1 ? `${key}.${regionTracker[key]}` : key);
            }
        }
    }
}

export function getId(node: Node, autogen: boolean = false): number {
    if (node === null) { return null; }
    let id = idMap.get(node);
    if (!id && autogen) {
        id = index++;
        idMap.set(node, id);
    }

    return id ? id : null;
}

export function add(node: Node, parent: Node, data: NodeInfo, source: Source): void {
    let id = getId(node, true);
    let parentId = parent ? getId(parent) : null;
    let previousId = getPreviousId(node);
    let masked = true;
    let parentValue = null;
    let regionId = regionMap.has(node) ? getId(node) : null;

    if (parentId >= 0 && values[parentId]) {
        parentValue = values[parentId];
        parentValue.children.push(id);
        regionId = regionId === null ? parentValue.region : regionId;
        masked = parentValue.metadata.masked;
    }

    // Check to see if this particular node should be masked or not
    masked = mask(data, masked);

    // If there's an explicit CLARITY_REGION_ATTRIBUTE set on the element, use it to mark a region on the page
    if (data.attributes && Constant.CLARITY_REGION_ATTRIBUTE in data.attributes) {
        regionMap.set(node, data.attributes[Constant.CLARITY_REGION_ATTRIBUTE]);
    }

    nodes[id] = node;
    values[id] = {
        id,
        parent: parentId,
        previous: previousId,
        children: [],
        position: null,
        data,
        selector: Constant.EMPTY_STRING,
        region: regionId,
        metadata: { active: true, region: false, masked }
    };
    updateSelector(values[id]);
    metadata(data.tag, id, parentId);
    track(id, source);
}

export function update(node: Node, parent: Node, data: NodeInfo, source: Source): void {
    let id = getId(node);
    let parentId = parent ? getId(parent) : null;
    let previousId = getPreviousId(node);
    let changed = false;

    if (id in values) {
        let value = values[id];
        value.metadata.active = true;

        // Handle case where internal ordering may have changed
        if (value.previous !== previousId) {
            changed = true;
            value.previous = previousId;
        }

        // Handle case where parent might have been updated
        if (value.parent !== parentId) {
            changed = true;
            let oldParentId = value.parent;
            value.parent = parentId;
            // Move this node to the right location under new parent
            if (parentId !== null && parentId >= 0) {
                let childIndex = previousId === null ? values[parentId].children.length : values[parentId].children.indexOf(previousId) + 1;
                values[parentId].children.splice(childIndex, 0, id);
                // Update region after the move
                value.region = regionMap.has(node) ? getId(node) : values[parentId].region;
            } else {
                // Mark this element as deleted if the parent has been updated to null
                remove(id, source);
            }

            // Remove reference to this node from the old parent
            if (oldParentId !== null && oldParentId >= 0) {
                let nodeIndex = values[oldParentId].children.indexOf(id);
                if (nodeIndex >= 0) {
                    values[oldParentId].children.splice(nodeIndex, 1);
                }
            }
        }

        // Update data
        for (let key in data) {
            if (diff(value["data"], data, key)) {
                changed = true;
                value["data"][key] = data[key];
            }
        }

        // Update selector
        updateSelector(value);
        metadata(data.tag, id, parentId);
        track(id, source, changed);
    }
}

export function sameorigin(node: Node): boolean {
    let output = false;
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === Constant.IFRAME_TAG) {
        let frame = node as HTMLIFrameElement;
        // To determine if the iframe is same-origin or not, we try accessing it's contentDocument.
        // If the browser throws an exception, we assume it's cross-origin and move on.
        // However, if we do a get a valid document object back, we assume the contents are accessible and iframe is same-origin.
        try {
            let doc = frame.contentDocument;
            if (doc) {
                iframeMap.set(frame.contentDocument, frame);
                output = true;
            }
        } catch { /* do nothing */ }
    }
    return output;
}

export function iframe(node: Node): HTMLIFrameElement {
    let doc = node.nodeType === Node.DOCUMENT_NODE ? node as Document : null;
    return doc && iframeMap.has(doc) ? iframeMap.get(doc) : null;
}

function mask(data: NodeInfo, masked: boolean): boolean {
    let attributes = data.attributes;
    let tag = data.tag.toUpperCase();

    // Do not proceed if attributes are missing for the node
    if (attributes === null || attributes === undefined) { return masked; }

    // Check for blacklist fields (e.g. address, phone, etc.) only if the input node is not already masked
    if (masked === false && tag === Constant.INPUT_TAG) {
        let field: string = Constant.EMPTY_STRING;
        // Be aggressive in looking up any attribute (id, class, name, etc.) for disallowed names
        for (const attribute of Object.keys(attributes)) { field += attributes[attribute].toLowerCase(); }
        for (let name of DISALLOWED_NAMES) {
            if (field.indexOf(name) >= 0) {
                masked = true;
                continue;
            }
        }
    }

    // Check for blacklist types (e.g. password, email, etc.) and set the masked property appropriately
    if (Constant.TYPE_ATTRIBUTE in attributes && DISALLOWED_TYPES.indexOf(attributes[Constant.TYPE_ATTRIBUTE]) >= 0) { masked = true; }

    // Following two conditions supersede any of the above. If there are explicit instructions to mask / unmask a field, we honor that.
    if (Constant.MASK_ATTRIBUTE in attributes) { masked = true; }
    if (Constant.UNMASK_ATTRIBUTE in attributes) { masked = false; }

    return masked;
}

function diff(a: NodeInfo, b: NodeInfo, field: string): boolean {
    if (typeof a[field] === "object" && typeof b[field] === "object") {
        for (let key in a[field]) { if (a[field][key] !== b[field][key]) { return true; } }
        for (let key in b[field]) { if (b[field][key] !== a[field][key]) { return true; } }
        return false;
    }
    return a[field] !== b[field];
}

function position(parent: NodeValue, child: NodeValue): number {
    let tag = child.data.tag;
    let hasClassName = child.data.attributes && !(Constant.CLASS_ATTRIBUTE in child.data.attributes);
    // Find relative position of the element to generate :nth-of-type selector
    // We restrict relative positioning to two cases:
    //   a) For specific whitelist of tags
    //   b) And, for remaining tags, only if they don't have a valid class name
    if (parent && ((tag === "DIV" || tag === "TR" || tag === "P" || tag === "LI" || tag === "UL") || hasClassName)) {
        child.position = 1;
        let idx = parent ? parent.children.indexOf(child.id) : -1;
        while (idx-- > 0) {
            let sibling = values[parent.children[idx]];
            if (child.data.tag === sibling.data.tag) { child.position = sibling.position + 1; }
            break;
        }
    }
    return child.position;
}

function updateSelector(value: NodeValue): void {
    let parent = value.parent && value.parent in values ? values[value.parent] : null;
    let prefix = parent ? `${parent.selector}>` : null;
    let ex = value.selector;
    let current = selector(value.data.tag, prefix, value.data.attributes, position(parent, value));
    if (current !== ex && selectorMap.indexOf(value.id) === -1) { selectorMap.push(value.id); }
    value.selector = current;
}

export function getNode(id: number): Node {
    if (id in nodes) {
        return nodes[id];
    }
    return null;
}

export function getMatch(url: string): Node {
    if (url in urlMap) {
        return getNode(urlMap[url]);
    }
    return null;
}

export function getValue(id: number): NodeValue {
    if (id in values) {
        return values[id];
    }
    return null;
}

export function get(node: Node): NodeValue {
    let id = getId(node);
    return id in values ? values[id] : null;
}

export function has(node: Node): boolean {
    return getId(node) in nodes;
}

export function region(regionId: number): string {
    let node = getNode(regionId);
    return node && regionMap.has(node) ? regionMap.get(node) : null;
}

export function regions(): NodeValue[] {
    let v = [];
    for (let id in values) {
        if (values[id].metadata.active && values[id].metadata.region) {
            v.push(values[id]);
        }
    }
    return v;
}

export function updates(): NodeValue[] {
    let output = [];
    for (let id of updateMap) {
        if (id in values) {
            let v = values[id];
            let p = v.parent;
            let hasId = "attributes" in v.data && Constant.ID_ATTRIBUTE in v.data.attributes;
            v.data.path = p === null || p in updateMap || hasId || v.selector.length === 0 ? null : values[p].selector;
            output.push(values[id]);
        }
    }
    updateMap = [];
    return output;
}

function remove(id: number, source: Source): void {
    if (id in values) {
        let value = values[id];
        value.metadata.active = false;
        value.parent = null;
        track(id, source);
    }
}

function metadata(tag: string, id: number, parentId: number): void {
    if (id !== null && parentId !== null) {
        let value = values[id];
        let attributes = "attributes" in value.data ? value.data.attributes : {};
        switch (tag) {
            case "VIDEO":
            case "AUDIO":
            case "LINK":
                // Track mapping between URL and corresponding nodes
                if (Constant.HREF_ATTRIBUTE in attributes && attributes[Constant.HREF_ATTRIBUTE].length > 0) {
                    urlMap[getFullUrl(attributes[Constant.HREF_ATTRIBUTE])] = id;
                }
                if (Constant.SRC_ATTRIBUTE in attributes && attributes[Constant.SRC_ATTRIBUTE].length > 0) {
                    if (attributes[Constant.SRC_ATTRIBUTE].indexOf(Constant.DATA_PREFIX) !== 0) {
                        urlMap[getFullUrl(attributes[Constant.SRC_ATTRIBUTE])] = id;
                    }
                }
                if (Constant.SRCSET_ATTRIBUTE in attributes && attributes[Constant.SRCSET_ATTRIBUTE].length > 0) {
                    let srcset = attributes[Constant.SRCSET_ATTRIBUTE];
                    let urls = srcset.split(",");
                    for (let u of urls) {
                        let parts = u.trim().split(" ");
                        if (parts.length === 2 && parts[0].length > 0) {
                            urlMap[getFullUrl(parts[0])] = id;
                        }
                    }
                }
                break;
        }

        // Toggle region boolean flag if this node defines a new region
        // This setting is not recursive and does not apply to any of the children.
        // It tells Clarity to monitor bounding rectangle (x,y,width,height) for this region.
        // E.g. region would be "SearchBox" and what's inside that region (input field, submit button, label, etc.) do not matter.
        if (regionMap.has(nodes[id])) { value.metadata.region = true; }
    }
}

function getFullUrl(relative: string): string {
    let a = document.createElement("a");
    a.href = relative;
    return a.href;
}

function getPreviousId(node: Node): number {
    let id = null;

    // Some nodes may not have an ID by design since Clarity skips over tags like SCRIPT, NOSCRIPT, META, COMMENTS, etc..
    // In that case, we keep going back and check for their sibling until we find a sibling with ID or no more sibling nodes are left.
    while (id === null && node.previousSibling) {
        id = getId(node.previousSibling);
        node = node.previousSibling;
    }
    return id;
}

function copy(input: NodeValue[]): NodeValue[] {
    return JSON.parse(JSON.stringify(input));
}

function track(id: number, source: Source, changed: boolean = true): void {
    // Keep track of the order in which mutations happened, they may not be sequential
    // Edge case: If an element is added later on, and pre-discovered element is moved as a child.
    // In that case, we need to reorder the prediscovered element in the update list to keep visualization consistent.
    let uIndex = updateMap.indexOf(id);
    if (uIndex >= 0 && source === Source.ChildListAdd) {
        updateMap.splice(uIndex, 1);
        updateMap.push(id);
    } else if (uIndex === -1 && changed) { updateMap.push(id); }

    if (Constant.DEVTOOLS_HOOK in window) {
        let value = copy([values[id]])[0];
        let change = { time: time(), source, value };
        if (!(id in changes)) { changes[id] = []; }
        changes[id].push(change);
    }
}

function history(id: number): NodeChange[] {
    if (id in changes) {
        return changes[id];
    }
    return [];
}
