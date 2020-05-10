import { Data, Layout } from "clarity-decode";
import { state } from "./clarity";

const ADOPTED_STYLE_SHEET = "clarity-adopted-style";
let nodes = {};
let boxmodels = {};

export function reset(): void {
    nodes = {};
    boxmodels = {};
}

export function boxmodel(event: Layout.BoxModelEvent): void {
    let data = event.data;
    let doc = state.player.contentDocument;
    for (let bm of data) {
        let rectangle = bm.box;
        let el = element(bm.id) as HTMLElement;
        if (rectangle) {
            let layer = el ? el : doc.createElement("DIV");
            layer.style.left = rectangle[0] + "px";
            layer.style.top = rectangle[1] + "px";
            layer.style.width = rectangle[2] + "px";
            layer.style.height = rectangle[3] + "px";
            layer.style.position = "absolute";
            layer.style.border = "1px solid red";
            doc.body.appendChild(layer);
            layer.innerText = bm.region;
            nodes[bm.id] = layer;
        }
        boxmodels[bm.id] = bm;
    }
}

export function element(nodeId: number): Node {
    return nodeId !== null && nodeId > 0 && nodeId in nodes ? nodes[nodeId] : null;
}

export function markup(event: Layout.DomEvent): void {
    let data = event.data;
    let type = event.event;
    let doc = state.player.contentDocument;
    for (let node of data) {
        let parent = element(node.parent);
        let pivot = element(node.previous);
        let insert = insertAfter;

        // For backward compatibility. Until v0.4.4 we used the next element to determine right ordering within DOM
        // Starting with v0.4.5, we moved away from the next element and instead starting sending previous element
        // This change fixes several edge cases where positioning of DOM could get inconsistent.
        // Example:
        // -- Let's say there's a parent X with two children: A, C. Then, A is mutated and a child B is inserted before C: X -> (A, B, C)
        // -- However, if we rely on pivot "next", then DOM will instead look incorrect like: X -> B, C, A. Because, payload will be:
        // ---- A: (Parent: X, Next: null // because B is yet undiscovered) | B: (Parent: X, Next: C // because C is already discovered)
        // ---- When we process A, since next is null, we will end up moving A as the last child (X -> C, A)
        // ---- Then we get to B, since next is a valid node C, we will place it before C, making DOM look like: (X -> B, C, A)
        // -- To avoid the above issue we rely on pivot "previous" node and that turns mutations from above example into:
        // ---- A: (Parent X, Prev: null // it's the first child) | B: (Parent: X, Prev: A // because A is already known)
        // ---- This leads us to desired DOM structure: X -> (A, B, C).
        if ("next" in node) {
            pivot = element(node.next);
            insert = insertBefore;
        }

        let tag = node.tag;
        if (tag && tag.indexOf(Layout.Constant.IFRAME_PREFIX) === 0) { tag = node.tag.substr(Layout.Constant.IFRAME_PREFIX.length); }
        switch (tag) {
            case Layout.Constant.DOCUMENT_TAG:
                let tagDoc = tag !== node.tag ? (parent ? (parent as HTMLIFrameElement).contentDocument : null): doc;
                if (tagDoc && tagDoc === doc && type === Data.Event.Discover) { reset(); }
                if (typeof XMLSerializer !== "undefined" && tagDoc) {
                    tagDoc.open();
                    tagDoc.write(new XMLSerializer().serializeToString(
                        tagDoc.implementation.createDocumentType(
                            node.attributes["name"],
                            node.attributes["publicId"],
                            node.attributes["systemId"]
                        )
                    ));
                    tagDoc.close();
                }
                break;
            case Layout.Constant.POLYFILL_SHADOWDOM_TAG:
                // In case of polyfill, map shadow dom to it's parent for rendering purposes
                // All its children should be inserted as regular children to the parent node.
                nodes[node.id] = parent;
                break;
            case Layout.Constant.SHADOW_DOM_TAG:
                if (parent) {
                    let shadowRoot = element(node.id);
                    shadowRoot = shadowRoot ? shadowRoot : (parent as HTMLElement).attachShadow({ mode: "open" });
                    if ("style" in node.attributes) {
                        let style = doc.createElement("style");
                        // Support for adoptedStyleSheet is limited and not available in all browsers.
                        // To ensure that we can replay session in any browser, we turn adoptedStyleSheets from recording
                        // into classic style tags at the playback time.
                        if (shadowRoot.firstChild && (shadowRoot.firstChild as HTMLElement).id === ADOPTED_STYLE_SHEET) {
                            style = shadowRoot.firstChild as HTMLStyleElement;
                        }
                        style.id = ADOPTED_STYLE_SHEET;
                        style.textContent = node.attributes["style"];
                        shadowRoot.appendChild(style);
                    }
                    nodes[node.id] = shadowRoot;
                }
                break;
            case Layout.Constant.TEXT_TAG:
                let textElement = element(node.id);
                textElement = textElement ? textElement : doc.createTextNode(null);
                textElement.nodeValue = node.value;
                insert(node, parent, textElement, pivot);
                break;
            case "HTML":
                let htmlDoc = tag !== node.tag ? (parent ? (parent as HTMLIFrameElement).contentDocument : null): doc;
                if (htmlDoc !== null) {
                    let docElement = element(node.id);
                    if (docElement === null) {
                        let newDoc = htmlDoc.implementation.createHTMLDocument(Layout.Constant.EMPTY_STRING);
                        docElement = newDoc.documentElement;
                        let p = htmlDoc.importNode(docElement, true);
                        htmlDoc.replaceChild(p, htmlDoc.documentElement);
                        if (htmlDoc.head) { htmlDoc.head.parentNode.removeChild(htmlDoc.head); }
                        if (htmlDoc.body) { htmlDoc.body.parentNode.removeChild(htmlDoc.body); }
                    }
                    setAttributes(htmlDoc.documentElement as HTMLElement, node.attributes);
                    nodes[node.id] = htmlDoc.documentElement;
                }
                break;
            case "HEAD":
                let headElement = element(node.id);
                if (headElement === null) {
                    headElement = doc.createElement(node.tag);
                    if (node.attributes && Layout.Constant.BASE_ATTRIBUTE in node.attributes) {
                        let base = doc.createElement("base");
                        base.href = node.attributes[Layout.Constant.BASE_ATTRIBUTE];
                        headElement.appendChild(base);
                    }
                }
                setAttributes(headElement as HTMLElement, node.attributes);
                insert(node, parent, headElement, pivot);
                break;
            case "STYLE":
                let styleElement = element(node.id);
                styleElement = styleElement ? styleElement : doc.createElement(node.tag);
                setAttributes(styleElement as HTMLElement, node.attributes);
                styleElement.textContent = node.value;
                insert(node, parent, styleElement, pivot);
                break;
            case "IFRAME":
                let iframeElement = element(node.id) as HTMLElement;
                iframeElement = iframeElement ? iframeElement : createElement(doc, node.tag);
                if (!node.attributes) { node.attributes = {}; }
                node.attributes["data-id"] = `${node.id}`;
                setAttributes(iframeElement as HTMLElement, node.attributes);
                if (!(Layout.Constant.SAME_ORIGIN_ATTRIBUTE in node.attributes)) { iframeElement.style.backgroundColor = "maroon"; }
                insert(node, parent, iframeElement, pivot);
                break;
            default:
                let domElement = element(node.id);
                domElement = domElement ? domElement : createElement(doc, node.tag);
                if (!node.attributes) { node.attributes = {}; }
                node.attributes["data-id"] = `${node.id}`;
                setAttributes(domElement as HTMLElement, node.attributes);
                insert(node, parent, domElement, pivot);
                break;
        }
    }
}

function createElement(doc: Document, tag: string): HTMLElement {
    if (tag && tag.indexOf(Layout.Constant.SVG_PREFIX) === 0) {
        return doc.createElementNS(Layout.Constant.SVG_NAMESPACE as string, tag.substr(Layout.Constant.SVG_PREFIX.length)) as HTMLElement;
    }
    return doc.createElement(tag);
}

function insertAfter(data: Layout.DomData, parent: Node, node: Node, previous: Node): void {
    let next = previous && previous.parentElement === parent ? previous.nextSibling : null;
    next = previous === null && parent ? parent.firstChild : next;
    insertBefore(data, parent, node, next);
}

function insertBefore(data: Layout.DomData, parent: Node, node: Node, next: Node): void {
    if (parent !== null) {
        next = next && next.parentElement !== parent ? null : next;
        try {
            parent.insertBefore(node, next);
        } catch (ex) {
            console.warn("Node: " + node + " | Parent: " + parent + " | Data: " + JSON.stringify(data));
            console.warn("Exception encountered while inserting node: " + ex);
        }
    } else if (parent === null && node.parentElement !== null) {
        node.parentElement.removeChild(node);
    }
    nodes[data.id] = node;
}

function setAttributes(node: HTMLElement, attributes: object): void {
    let tag = node.nodeType === Node.ELEMENT_NODE ? node.tagName.toLowerCase() : null;
    // First remove all its existing attributes
    if (node.attributes) {
        let length = node.attributes.length;
        while (node.attributes && length > 0) {
            node.removeAttribute(node.attributes[0].name);
            length--;
        }
    }

    // Add new attributes
    for (let attribute in attributes) {
        if (attributes[attribute] !== undefined) {
            try {
                let v = attributes[attribute];
                if (attribute.indexOf("xlink:") === 0) {
                    node.setAttributeNS("http://www.w3.org/1999/xlink", attribute, v);
                } else if (attribute.indexOf("*") === 0) {
                    // Do nothing if we encounter internal Clarity attributes
                } else if (tag === "iframe" && (attribute.indexOf("src") === 0 || attribute.indexOf("allow") === 0) || attribute === "sandbox") {
                    node.setAttribute(`data-clarity-${attribute}`, v);
                } else {
                    node.setAttribute(attribute, v);
                }
            } catch (ex) {
                console.warn("Node: " + node + " | " + JSON.stringify(attributes));
                console.warn("Exception encountered while adding attributes: " + ex);
            }
        }
    }
}
