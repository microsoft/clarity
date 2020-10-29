import { Privacy } from "@clarity-types/core";
import { Setting } from "@clarity-types/data";
import { Constant, NodeChange, NodeInfo, NodeValue, Source } from "@clarity-types/layout";
import config from "@src/core/config";
import { time } from "@src/core/time";
import selector from "@src/layout/selector";

let index: number = 1;

// Reference: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Input#%3Cinput%3E_types
const DISALLOWED_TYPES = ["password", "hidden", "email", "tel"];
const DISALLOWED_NAMES = ["addr", "cell", "code", "dob", "email", "mob", "name", "phone", "secret", "social", "ssn", "tel", "zip", "pass"];
const DISALLOWED_MATCH = ["address", "password", "contact"];

let nodes: Node[] = [];
let values: NodeValue[] = [];
let changes: NodeChange[][] = [];
let updateMap: number[] = [];
let selectorMap: number[] = [];

// The WeakMap object is a collection of key/value pairs in which the keys are weakly referenced
let idMap: WeakMap<Node, number> = null; // Maps node => id.
let regionMap: WeakMap<Node, string> = null; // Maps region nodes => region name
let iframeMap: WeakMap<Document, HTMLIFrameElement> = null; // Maps iframe's contentDocument => parent iframe element
let privacyMap: WeakMap<Node, Privacy> = null; // Maps node => Privacy (enum)

let urlMap: { [url: string]: number } = {};

export function start(): void {
    reset();
    parse(document);
}

export function stop(): void {
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
    privacyMap = new WeakMap();
    if (Constant.DevHook in window) { window[Constant.DevHook] = { get, getNode, history }; }
}

// We parse new root nodes for any regions or masked nodes in the beginning (document) and
// later whenever there are new additions or modifications to DOM (mutations)
export function parse(root: ParentNode): void {
    // Since mutations may happen on leaf nodes too, e.g. text nodes, which may not support all selector APIs.
    // We ensure that the root note supports querySelector API before executing the code below to identify new regions.
    if ("querySelector" in root) {
        // Extract regions
        for (const key of Object.keys(config.regions)) {
            let element = root.querySelector(config.regions[key]);
            if (element) { regionMap.set(element, key); }
        }

        // Extract nodes with explicit masked configuration
        for (const entry of config.mask) {
            let elements = root.querySelectorAll(entry);
            for (let i = 0; i < elements.length; i++) {
                privacyMap.set(elements[i], Privacy.TextImage);
            }
        }

        // Extract nodes with explicit unmasked configuration
        for (const entry of config.unmask) {
            let elements = root.querySelectorAll(entry);
            for (let i = 0; i < elements.length; i++) {
                privacyMap.set(elements[i], Privacy.None);
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
    let privacy = config.content ? Privacy.Sensitive : Privacy.Text;
    let parentValue = null;
    let parentTag = Constant.Empty;
    let regionId = regionMap.has(node) ? getId(node) : null;

    if (parentId >= 0 && values[parentId]) {
        parentValue = values[parentId];
        parentTag = parentValue.data.tag;
        parentValue.children.push(id);
        regionId = regionId === null ? parentValue.region : regionId;
        privacy = parentValue.metadata.privacy;
    }

    // Check to see if this particular node should be masked or not
    privacy = getPrivacy(node, data, parentTag, privacy);

    // If there's an explicit region attribute set on the element, use it to mark a region on the page
    if (data.attributes && Constant.RegionData in data.attributes) { regionMap.set(node, data.attributes[Constant.RegionData]); }

    nodes[id] = node;
    values[id] = {
        id,
        parent: parentId,
        previous: previousId,
        children: [],
        position: null,
        data,
        selector: Constant.Empty,
        region: regionId,
        metadata: { active: true, region: false, privacy, size: null }
    };

    updateSelector(values[id]);
    size(values[id], parentValue);
    metadata(data.tag, id, parentId);
    track(id, source);
}

export function update(node: Node, parent: Node, data: NodeInfo, source: Source): void {
    let id = getId(node);
    let parentId = parent ? getId(parent) : null;
    let previousId = getPreviousId(node);
    let changed = false;
    let parentChanged = false;

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
                let childIndex = previousId === null ? 0 : values[parentId].children.indexOf(previousId) + 1;
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
            parentChanged = true;
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
        track(id, source, changed, parentChanged);
    }
}

export function sameorigin(node: Node): boolean {
    let output = false;
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === Constant.IFrameTag) {
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

function getPrivacy(node: Node, data: NodeInfo, parentTag: string, privacy: Privacy): Privacy {
    let attributes = data.attributes;
    let tag = data.tag.toUpperCase();

    // If this node was explicitly configured to contain sensitive content, use that information and return the value
    if (privacyMap.has(node)) { return privacyMap.get(node); }

    // Do not proceed if attributes are missing for the node
    if (attributes === null || attributes === undefined) { return privacy; }

    // Look up for sensitive fields
    if (Constant.Class in attributes && privacy === Privacy.Sensitive) {
        for (let match of DISALLOWED_MATCH) {
            if (attributes[Constant.Class].indexOf(match) >= 0) {
                privacy = Privacy.Text;
                break;
            }
        }
    }

    // Check for disallowed list of fields (e.g. address, phone, etc.) only if the input node is not already masked
    if (tag === Constant.InputTag) {
        if (privacy === Privacy.None) {
            let field: string = Constant.Empty;
            // Be aggressive in looking up any attribute (id, class, name, etc.) for disallowed names
            for (const attribute of Object.keys(attributes)) { field += attributes[attribute].toLowerCase(); }
            for (let name of DISALLOWED_NAMES) {
                if (field.indexOf(name) >= 0) {
                    privacy = Privacy.Text;
                    break;
                }
            }
        } else if (privacy === Privacy.Sensitive) { privacy = Privacy.Text; }
    }

    // Check for disallowed list of types (e.g. password, email, etc.) and set the masked property appropriately
    if (Constant.Type in attributes && DISALLOWED_TYPES.indexOf(attributes[Constant.Type]) >= 0) { privacy = Privacy.Text; }

    // Following two conditions supersede any of the above. If there are explicit instructions to mask / unmask a field, we honor that.
    if (Constant.MaskData in attributes) { privacy = Privacy.TextImage; }
    if (Constant.UnmaskData in attributes) { privacy = Privacy.None; }

    // If it's a text node belonging to a STYLE or TITLE tag; then reset the privacy setting to ensure we capture the content
    let cTag = tag === Constant.TextTag ? parentTag : tag;
    if (cTag === Constant.StyleTag || cTag === Constant.TitleTag) { privacy = Privacy.None; }

    return privacy;
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
    let hasClassName = child.data.attributes && !(Constant.Class in child.data.attributes);
    // Find relative position of the element to generate :nth-of-type selector
    // We restrict relative positioning to two cases:
    //   a) For specific whitelist of tags
    //   b) And, for remaining tags, only if they don't have a valid class name
    if (parent && (["DIV", "TR", "P", "LI", "UL", "A", "BUTTON"].indexOf(tag) >= 0 || hasClassName)) {
        child.position = 1;
        let idx = parent ? parent.children.indexOf(child.id) : -1;
        while (idx-- > 0) {
            let sibling = values[parent.children[idx]];
            if (child.data.tag === sibling.data.tag) {
                child.position = sibling.position + 1;
                break;
            }
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

export function getRegion(regionId: number): string {
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
            v.data.path = p === null || updateMap.indexOf(p) >= 0 || v.selector.length === 0 ? null : values[p].selector;
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

function size(value: NodeValue, parent: NodeValue): void {
    let data = value.data;
    let tag = data.tag;

    // If this element is a text node, is masked, and longer than configured length, then track box model for the parent element
    let isLongText = tag === Constant.TextTag && data.value && data.value.length > Setting.ResizeObserverThreshold;
    let isMasked = value.metadata.privacy === Privacy.Text || value.metadata.privacy === Privacy.TextImage;
    if (isLongText && isMasked && parent && parent.metadata.size === null) { parent.metadata.size = []; }

    // If this element is a image node, and is masked, then track box model for the current element
    if (data.tag === Constant.ImageTag && value.metadata.privacy === Privacy.TextImage) { value.metadata.size = []; }
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
                if (Constant.Href in attributes && attributes[Constant.Href].length > 0) {
                    urlMap[getFullUrl(attributes[Constant.Href])] = id;
                }
                if (Constant.Src in attributes && attributes[Constant.Src].length > 0) {
                    if (attributes[Constant.Src].indexOf(Constant.DataPrefix) !== 0) {
                        urlMap[getFullUrl(attributes[Constant.Src])] = id;
                    }
                }
                if (Constant.Srcset in attributes && attributes[Constant.Srcset].length > 0) {
                    let srcset = attributes[Constant.Srcset];
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

function track(id: number, source: Source, changed: boolean = true, parentChanged: boolean = false): void {
    // Keep track of the order in which mutations happened, they may not be sequential
    // Edge case: If an element is added later on, and pre-discovered element is moved as a child.
    // In that case, we need to reorder the pre-discovered element in the update list to keep visualization consistent.
    let uIndex = updateMap.indexOf(id);
    if (uIndex >= 0 && source === Source.ChildListAdd && parentChanged) {
        updateMap.splice(uIndex, 1);
        updateMap.push(id);
    } else if (uIndex === -1 && changed) { updateMap.push(id); }

    if (Constant.DevHook in window) {
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
