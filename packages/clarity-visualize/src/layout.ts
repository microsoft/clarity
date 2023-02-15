import { Data, Layout } from "clarity-js";
import type { Layout as DecodedLayout } from "clarity-decode";
import { Asset, Constant, LinkHandler, NodeType, PlaybackState, Setting } from "@clarity-types/visualize";

export class LayoutHelper {
    static TIMEOUT = 3000;

    stylesheets: Promise<void>[] = [];
    fonts: Promise<void>[] = [];
    nodes = {};
    events = {};
    hashMapAlpha = {};
    hashMapBeta = {};
    state: PlaybackState = null;

    constructor(state: PlaybackState) {
        this.state = state;
    }

    public reset = (): void => {
        this.nodes = {};
        this.stylesheets = [];
        this.fonts = [];
        this.events = {};
        this.hashMapAlpha = {};
        this.hashMapBeta = {};
    }

    public get = (hash) => {
        if (hash in this.hashMapBeta && this.hashMapBeta[hash].isConnected) {
            return this.hashMapBeta[hash];
        } else if (hash in this.hashMapAlpha && this.hashMapAlpha[hash].isConnected) {
            return this.hashMapAlpha[hash];
        }
        return null;
    }

    private addToHashMap = (data: DecodedLayout.DomData, parent: Node) => {
        // In case of selector collision, prefer the first inserted node
        this.hashMapAlpha[data.hashAlpha] = this.get(data.hashAlpha) || parent;
        this.hashMapBeta[data.hashBeta] = this.get(data.hashBeta) || parent;
    }

    private resize = (el: HTMLElement, width: number, height: number): void => {
        if (el && el.nodeType === NodeType.ELEMENT_NODE && width && height) {
            el.style.width = width + Layout.Constant.Pixel;
            el.style.height = height + Layout.Constant.Pixel;
            el.style.boxSizing = Layout.Constant.BorderBox; // Reference: https://developer.mozilla.org/en-US/docs/Web/CSS/box-sizing
        }
    }

    public element = (nodeId: number): Node => {
        return nodeId !== null && nodeId > 0 && nodeId in this.nodes ? this.nodes[nodeId] : null;
    }

    public dom = async (event: DecodedLayout.DomEvent, useproxy?: LinkHandler): Promise<void> => {
        if (event) {
            // When setting up rendering for the first time, start off with hidden target window
            // This ensures we do not show flickers to the end user
            let doc = this.state.window.document;
            if (doc && doc.documentElement) {
                doc.documentElement.style.visibility = Constant.Hidden;
                // Render all DOM events to reconstruct the page
                await this.markup(event, useproxy);
                // Toggle back the visibility of target window
                doc.documentElement.style.visibility = Constant.Visible;
            }
        }
    }

    public exists = (hash: string): boolean => {
        if (hash) {
            let match = this.get(hash);
            if (match) {
                let rectangle = match.getBoundingClientRect();
                return rectangle && rectangle.width > 0 && rectangle.height > 0;
            }
        }
        return false;
    }

    public markup = async (event: DecodedLayout.DomEvent, useproxy?: LinkHandler): Promise<void> => {
        let data = event.data;
        let type = event.event;
        let doc = this.state.window.document;
        for (let node of data) {
            let parent = this.element(node.parent);
            let pivot = this.element(node.previous);
            let insert = this.insertAfter;

            let tag = node.tag;
            if (tag && tag.indexOf(Layout.Constant.IFramePrefix) === 0) { tag = node.tag.substr(Layout.Constant.IFramePrefix.length); }
            switch (tag) {
                case Layout.Constant.DocumentTag:
                    let tagDoc = tag !== node.tag ? (parent ? (parent as HTMLIFrameElement).contentDocument : null): doc;
                    if (tagDoc && tagDoc === doc && type === Data.Event.Discover) { this.reset(); }
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
                case Layout.Constant.PolyfillShadowDomTag:
                    // In case of polyfill, map shadow dom to it's parent for rendering purposes
                    // All its children should be inserted as regular children to the parent node.
                    this.nodes[node.id] = parent;
                    this.addToHashMap(node, parent);
                    break;
                case Layout.Constant.ShadowDomTag:
                    if (parent) {
                        let shadowRoot = this.element(node.id);
                        shadowRoot = shadowRoot ? shadowRoot : (parent as HTMLElement).attachShadow({ mode: "open" });
                        if ("style" in node.attributes) {
                            let shadowStyle = doc.createElement("style");
                            // Support for adoptedStyleSheet is limited and not available in all browsers.
                            // To ensure that we can replay session in any browser, we turn adoptedStyleSheets from recording
                            // into classic style tags at the playback time.
                            if (shadowRoot.firstChild && (shadowRoot.firstChild as HTMLElement).id === Constant.AdoptedStyleSheet) {
                                shadowStyle = shadowRoot.firstChild as HTMLStyleElement;
                            }
                            shadowStyle.id = Constant.AdoptedStyleSheet;
                            shadowStyle.textContent = node.attributes["style"];
                            shadowRoot.appendChild(shadowStyle);
                        }
                        this.nodes[node.id] = shadowRoot;
                        this.addToHashMap(node, shadowRoot);
                    }
                    break;
                case Layout.Constant.TextTag:
                    let textElement = this.element(node.id);
                    textElement = textElement ? textElement : doc.createTextNode(null);
                    textElement.nodeValue = node.value;
                    insert(node, parent, textElement, pivot);
                    break;
                case Layout.Constant.SuspendMutationTag:
                    let suspendedElement = this.element(node.id);
                    if (suspendedElement && suspendedElement.nodeType === Node.ELEMENT_NODE) {
                        (suspendedElement as HTMLElement).setAttribute(Constant.Suspend, Layout.Constant.Empty);
                    }
                    break;
                case "HTML":
                    let htmlDoc = tag !== node.tag ? (parent ? (parent as HTMLIFrameElement).contentDocument : null): doc;
                    if (htmlDoc !== null) {
                        let docElement = this.element(node.id) as HTMLElement;
                        if (docElement === null) {
                            let newDoc = htmlDoc.implementation.createHTMLDocument(Layout.Constant.Empty);
                            docElement = newDoc.documentElement;
                            let p = htmlDoc.importNode(docElement, true);
                            htmlDoc.replaceChild(p, htmlDoc.documentElement);
                            if (htmlDoc.head) { htmlDoc.head.parentNode.removeChild(htmlDoc.head); }
                            if (htmlDoc.body) { htmlDoc.body.parentNode.removeChild(htmlDoc.body); }
                        }
                        this.setAttributes(htmlDoc.documentElement, node);
                        // If we are still processing discover events, keep the markup hidden until we are done
                        if (type === Data.Event.Discover && !parent) { htmlDoc.documentElement.style.visibility = Constant.Hidden; }
                        this.nodes[node.id] = htmlDoc.documentElement;
                        this.addToHashMap(node, htmlDoc.documentElement);
                    }
                    break;
                case "HEAD":
                    let headElement = this.element(node.id);
                    if (headElement === null) {
                        headElement = doc.createElement(node.tag);
                        if (node.attributes && Layout.Constant.Base in node.attributes) {
                            let base = doc.createElement("base");
                            base.href = node.attributes[Layout.Constant.Base];
                            headElement.appendChild(base);
                        }

                        // Add custom styles to assist with visualization
                        let custom = doc.createElement("style");
                        custom.innerText = this.getCustomStyle();
                        headElement.appendChild(custom);
                    }
                    this.setAttributes(headElement as HTMLElement, node);
                    insert(node, parent, headElement, pivot);
                    break;
                case "LINK":
                    let linkElement = this.element(node.id) as HTMLLinkElement;
                    linkElement = linkElement ? linkElement : this.createElement(doc, node.tag) as HTMLLinkElement;
                    if (!node.attributes) { node.attributes = {}; }
                    this.setAttributes(linkElement as HTMLElement, node);
                    if ("rel" in node.attributes) {
                        if (node.attributes["rel"] === "stylesheet") {
                            this.stylesheets.push(new Promise((resolve: () => void): void => {
                                const proxy = useproxy ?? this.state.options.useproxy;
                                linkElement.href = proxy ? proxy(linkElement.href) : linkElement.href;
                                linkElement.onload = linkElement.onerror = this.style.bind(this, linkElement, resolve);
                                setTimeout(resolve, LayoutHelper.TIMEOUT);
                            }));
                        } else if ((node.attributes["rel"].includes("preload") || node.attributes["rel"].includes("preconnect"))
                            && (node.attributes?.as === "style" || node.attributes?.as === "font")) {
                                this.fonts.push(new Promise((resolve: () => void): void => {
                                    const proxy = useproxy ?? this.state.options.useproxy;
                                    linkElement.href = proxy ? proxy(linkElement.href) : linkElement.href;
                                    linkElement.onload = linkElement.onerror = this.style.bind(this, linkElement, resolve);
                                    setTimeout(resolve, LayoutHelper.TIMEOUT);
                                }));
                            }
                    }
                    insert(node, parent, linkElement, pivot);
                    break;
                case "STYLE":
                    let styleElement = this.element(node.id) as HTMLStyleElement ?? doc.createElement(node.tag) as HTMLStyleElement;
                    this.setAttributes(styleElement as HTMLElement, node);
                    styleElement.textContent = node.value;
                    insert(node, parent, styleElement, pivot);
                    this.style(styleElement);
                    break;
                case "IFRAME":
                    let iframeElement = this.element(node.id) as HTMLElement;
                    iframeElement = iframeElement ? iframeElement : this.createElement(doc, node.tag);
                    if (!node.attributes) { node.attributes = {}; }
                    this.setAttributes(iframeElement as HTMLElement, node);
                    insert(node, parent, iframeElement, pivot);
                    break;
                default:
                    let domElement = this.element(node.id) as HTMLElement;
                    domElement = domElement ? domElement : this.createElement(doc, node.tag);
                    this.setAttributes(domElement as HTMLElement, node);
                    this.resize(domElement, node.width, node.height);
                    insert(node, parent, domElement, pivot);
                    break;
            }
            // Track state for this node
            if (node.id) { this.events[node.id] = node; }
        }
        // Wait on all stylesheets and fonts to finish loading
        await Promise.all([this.stylesheets, this.fonts]);
        this.stylesheets = [];
        this.fonts = [];
    }

    private style = (node: HTMLLinkElement | HTMLStyleElement, resolve: () => void = null): void => {
        // Firefox throws a SecurityError when trying to access cssRules of a stylesheet from a different domain
        try {
            const sheet = node.sheet as CSSStyleSheet;
            let cssRules = sheet ? sheet.cssRules : [];
            for (let i = 0; i < cssRules.length; i++) {
                if (cssRules[i].cssText.indexOf(Constant.Hover) >= 0) {
                    let css = cssRules[i].cssText.replace(/:hover/g, `[${Constant.CustomHover}]`);
                    sheet.removeRule(i);
                    sheet.insertRule(css, i);
                }
            }
        } catch (e) {
            if (this.state.options.logerror) {
                this.state.options.logerror(e);
            }
        }

        if (resolve) { resolve(); }
    }

    private createElement = (doc: Document, tag: string): HTMLElement => {
        if (tag && tag.indexOf(Layout.Constant.SvgPrefix) === 0) {
            return doc.createElementNS(Layout.Constant.SvgNamespace as string, tag.substr(Layout.Constant.SvgPrefix.length)) as HTMLElement;
        }
        try { return doc.createElement(tag); } catch (ex) {
            // We log the warning on non-standard markup but continue with the visualization
            console.warn(`Exception encountered while creating element ${tag}: ${ex}`);
            return doc.createElement(Constant.UnknownTag);
        };
    }

    private insertAfter = (data: DecodedLayout.DomData, parent: Node, node: Node, previous: Node): void => {
        // Skip over no-op changes where parent and previous element is still the same
        // In case of IFRAME, re-adding DOM at the exact same place will lead to loss of state and the markup inside will be destroyed
        if (this.events[data.id] && this.events[data.id].parent === data.parent && this.events[data.id].previous === data.previous) { return; }
        // In case parent is a Shadow DOM, previous.parentElement will return null but previous.parentNode will return a valid node
        let next = previous && (previous.parentElement === parent || previous.parentNode === parent) ? previous.nextSibling : null;
        next = previous === null && parent ? this.firstChild(parent) : next;
        this.insertBefore(data, parent, node, next);
    }

    private firstChild = (node: Node): ChildNode => {
        let child = node.firstChild;
        // BASE tag should always be the first child to ensure resources with relative URLs are loaded correctly
        if (child && child.nodeType === NodeType.ELEMENT_NODE && (child as HTMLElement).tagName === Layout.Constant.BaseTag) {
            return child.nextSibling;
        }
        return child;
    }

    private insertBefore = (data: DecodedLayout.DomData, parent: Node, node: Node, next: Node): void => {
        if (parent !== null) {
            // Compare against both parentNode and parentElement to ensure visualization works correctly for shadow DOMs
            next = next && (next.parentElement !== parent && next.parentNode !== parent) ? null : next;
            try {
                parent.insertBefore(node, next);
            } catch (ex) {
                console.warn("Node: " + node + " | Parent: " + parent + " | Data: " + JSON.stringify(data));
                console.warn("Exception encountered while inserting node: " + ex);
            }
        } else if (parent === null && node.parentElement !== null) {
            node.parentElement.removeChild(node);
        } else if (parent === null && node.parentNode !== null) {
            node.parentNode.removeChild(node);
        }
        this.nodes[data.id] = node;
        this.addToHashMap(data, node);
    }

    private setAttributes = (node: HTMLElement, data: DecodedLayout.DomData): void => {
        let attributes = data.attributes || {};
        let sameorigin = false;

        // Clarity attributes
        attributes[Constant.Id] = `${data.id}`;
        attributes[Constant.HashAlpha] = `${data.hashAlpha}`;
        attributes[Constant.HashBeta] = `${data.hashBeta}`;

        let tag = node.nodeType === NodeType.ELEMENT_NODE ? node.tagName.toLowerCase() : null;
        // First remove all its existing attributes
        if (node.attributes) {
            let length = node.attributes.length;
            while (node.attributes && length > 0) {
                // Do not remove "clarity-hover" attribute and let it be managed by interaction module
                // This helps avoid flickers during visualization
                if (node.attributes[0].name !== Constant.HoverAttribute) {
                    node.removeAttribute(node.attributes[0].name);
                }
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
                    } else if (attribute.indexOf(Layout.Constant.SameOrigin) === 0) {
                        sameorigin = true;
                    } else if (attribute.indexOf("*") === 0) {
                        // Do nothing if we encounter internal Clarity attributes
                    } else if (tag === Constant.IFrameTag && (attribute.indexOf("src") === 0 || attribute.indexOf("allow") === 0) || attribute === "sandbox") {
                        node.setAttribute(`data-clarity-${attribute}`, v);
                    } else if (tag === Constant.ImageTag && attribute.indexOf("src") === 0 && (v === null || v.length === 0)) {
                        node.setAttribute(attribute, Asset.Transparent);
                        let size = Constant.Large;
                        if (data.width) {
                            size = data.width <= Setting.Medium ? Constant.Medium : (data.width <= Setting.Small ? Constant.Small : size);
                        }
                        node.setAttribute(Constant.Hide, size);
                    } else {
                        node.setAttribute(attribute, v);
                    }
                } catch (ex) {
                    console.warn("Node: " + node + " | " + JSON.stringify(attributes));
                    console.warn("Exception encountered while adding attributes: " + ex);
                }
            }
        }

        if (sameorigin === false && tag === Constant.IFrameTag && typeof node.setAttribute === Constant.Function) {
            node.setAttribute(Constant.Unavailable, Layout.Constant.Empty);
        }

        // Add an empty ALT tag on all IMG elements
        if (tag === Constant.ImageTag && !node.hasAttribute(Constant.AltAttribute)) { node.setAttribute(Constant.AltAttribute, Constant.Empty); }

        // During visualization This will prevent the browser from auto filling form fields with saved details of user who is seeing the visualization
        if (tag === Constant.FormTag || tag === Constant.InputTag) { 
            if (node.hasAttribute(Constant.AutoComplete)) {
                node.removeAttribute(Constant.AutoComplete);
            }
            node.setAttribute(Constant.AutoComplete, Constant.NewPassword); 
        }
    }

    private getCustomStyle = (): string => {
        // tslint:disable-next-line: max-line-length
        return `${Constant.ImageTag}[${Constant.Hide}] { background-color: #CCC; background-image: url(${Asset.Hide}); background-repeat:no-repeat; background-position: center; }` +
            `${Constant.ImageTag}[${Constant.Hide}=${Constant.Small}] { background-size: 18px 18px; }` +
            `${Constant.ImageTag}[${Constant.Hide}=${Constant.Medium}] { background-size: 24px 24px; }` +
            `${Constant.ImageTag}[${Constant.Hide}=${Constant.Large}] { background-size: 36px 36px; }` +
            `${Constant.IFrameTag}[${Constant.Unavailable}] { background: url(${Asset.Unavailable}) no-repeat center center, url('${Asset.Cross}'); }` +
            `*[${Constant.Suspend}] { filter: grayscale(100%); }`;
    }
}
