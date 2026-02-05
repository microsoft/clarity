import { Data, Layout } from "clarity-js";
import type { Layout as DecodedLayout } from "clarity-decode";
import { Asset, Constant, type LinkHandler, NodeType, type PlaybackState, Setting } from "@clarity-types/visualize";
import { StyleSheetOperation } from "clarity-js/types/layout";
import { AnimationOperation } from "clarity-js/types/layout";
import { Constant as LayoutConstants } from "clarity-js/types/layout";
import sharedStyle from "./styles/shared.css";

/* BEGIN blobUnavailableSvgs */
import blobUnavailableSvgEnglish from "./styles/blobUnavailable/english.svg";
import blobUnavailableSvgSmall from "./styles/blobUnavailable/iconOnly.svg";
import blobUnavailableSvgChineseSimplified from "./styles/blobUnavailable/chineseSimplified.svg";
import blobUnavailableSvgChineseTraditional from "./styles/blobUnavailable/chineseTraditional.svg";
import blobUnavailableSvgJapanese from "./styles/blobUnavailable/japanese.svg";
import blobUnavailableSvgKorean from "./styles/blobUnavailable/korean.svg";
import blobUnavailableSvgRussian from "./styles/blobUnavailable/russian.svg";
import blobUnavailableSvgSpanish from "./styles/blobUnavailable/spanish.svg";
import blobUnavailableSvgTurkish from "./styles/blobUnavailable/turkish.svg";
import blobUnavailableSvgDutch from "./styles/blobUnavailable/dutch.svg";
import blobUnavailableSvgFrench from "./styles/blobUnavailable/french.svg";
import blobUnavailableSvgGerman from "./styles/blobUnavailable/german.svg";
import blobUnavailableSvgItalian from "./styles/blobUnavailable/italian.svg";
import blobUnavailableSvgPortuguese from "./styles/blobUnavailable/portuguese.svg";
const blobUnavailableSvg = {
    "de-de": blobUnavailableSvgGerman,
    "en-gb": blobUnavailableSvgEnglish,
    "en-us": blobUnavailableSvgEnglish,
    "es-es": blobUnavailableSvgSpanish,
    "fr-fr": blobUnavailableSvgFrench,
    "it-it": blobUnavailableSvgItalian,
    "ja-jp": blobUnavailableSvgJapanese,
    "ko-kr": blobUnavailableSvgKorean,
    "nl-nl": blobUnavailableSvgDutch,
    "pt-br": blobUnavailableSvgPortuguese,
    "ru-ru": blobUnavailableSvgRussian,
    "tr-tr": blobUnavailableSvgTurkish,
    "zh-hans": blobUnavailableSvgChineseSimplified,
    "zh-hant": blobUnavailableSvgChineseTraditional,
}
/* END blobUnavailableSvgs */

/* BEGIN iframeUnavailableSvgs */
import iframeUnavailableSvgEnglish from "./styles/iframeUnavailable/english.svg";
import iframeUnavailableSvgSmall from "./styles/iframeUnavailable/iconOnly.svg";
import iframeUnavailableSvgChineseSimplified from "./styles/iframeUnavailable/chineseSimplified.svg";
import iframeUnavailableSvgChineseTraditional from "./styles/iframeUnavailable/chineseTraditional.svg";
import iframeUnavailableSvgJapanese from "./styles/iframeUnavailable/japanese.svg";
import iframeUnavailableSvgKorean from "./styles/iframeUnavailable/korean.svg";
import iframeUnavailableSvgRussian from "./styles/iframeUnavailable/russian.svg";
import iframeUnavailableSvgSpanish from "./styles/iframeUnavailable/spanish.svg";
import iframeUnavailableSvgTurkish from "./styles/iframeUnavailable/turkish.svg";
import iframeUnavailableSvgDutch from "./styles/iframeUnavailable/dutch.svg";
import iframeUnavailableSvgFrench from "./styles/iframeUnavailable/french.svg";
import iframeUnavailableSvgGerman from "./styles/iframeUnavailable/german.svg";
import iframeUnavailableSvgItalian from "./styles/iframeUnavailable/italian.svg";
import iframeUnavailableSvgPortuguese from "./styles/iframeUnavailable/portuguese.svg";
const iframeUnavailableSvg = {
    "de-de": iframeUnavailableSvgGerman,
    "en-gb": iframeUnavailableSvgEnglish,
    "en-us": iframeUnavailableSvgEnglish,
    "es-es": iframeUnavailableSvgSpanish,
    "fr-fr": iframeUnavailableSvgFrench,
    "it-it": iframeUnavailableSvgItalian,
    "ja-jp": iframeUnavailableSvgJapanese,
    "ko-kr": iframeUnavailableSvgKorean,
    "nl-nl": iframeUnavailableSvgDutch,
    "pt-br": iframeUnavailableSvgPortuguese,
    "ru-ru": iframeUnavailableSvgRussian,
    "tr-tr": iframeUnavailableSvgTurkish,
    "zh-hans": iframeUnavailableSvgChineseSimplified,
    "zh-hant": iframeUnavailableSvgChineseTraditional,
}
/* END iframeUnavailableSvgs */

/* BEGIN imageMaskedSvgs */
import imageMaskedSvgEnglish from "./styles/imageMasked/english.svg";
import imageMaskedSvgSmall from "./styles/imageMasked/iconOnly.svg";
import imageMaskedSvgChineseSimplified from "./styles/imageMasked/chineseSimplified.svg";
import imageMaskedSvgChineseTraditional from "./styles/imageMasked/chineseTraditional.svg";
import imageMaskedSvgJapanese from "./styles/imageMasked/japanese.svg";
import imageMaskedSvgKorean from "./styles/imageMasked/korean.svg";
import imageMaskedSvgRussian from "./styles/imageMasked/russian.svg";
import imageMaskedSvgSpanish from "./styles/imageMasked/spanish.svg";
import imageMaskedSvgTurkish from "./styles/imageMasked/turkish.svg";
import imageMaskedSvgDutch from "./styles/imageMasked/dutch.svg";
import imageMaskedSvgFrench from "./styles/imageMasked/french.svg";
import imageMaskedSvgGerman from "./styles/imageMasked/german.svg";
import imageMaskedSvgItalian from "./styles/imageMasked/italian.svg";
import imageMaskedSvgPortuguese from "./styles/imageMasked/portuguese.svg";
const imageMaskedSvg = {
    "de-de": imageMaskedSvgGerman,
    "en-gb": imageMaskedSvgEnglish,
    "en-us": imageMaskedSvgEnglish,
    "es-es": imageMaskedSvgSpanish,
    "fr-fr": imageMaskedSvgFrench,
    "it-it": imageMaskedSvgItalian,
    "ja-jp": imageMaskedSvgJapanese,
    "ko-kr": imageMaskedSvgKorean,
    "nl-nl": imageMaskedSvgDutch,
    "pt-br": imageMaskedSvgPortuguese,
    "ru-ru": imageMaskedSvgRussian,
    "tr-tr": imageMaskedSvgTurkish,
    "zh-hans": imageMaskedSvgChineseSimplified,
    "zh-hant": imageMaskedSvgChineseTraditional,
}
/* END imageMaskedSvgs */

export class LayoutHelper {
    static TIMEOUT = 3000;

    primaryHtmlNodeId: number | null = null;
    isMobile: boolean;
    stylesheets: Promise<void>[] = [];
    fonts: Promise<void>[] = [];
    nodes = {};
    events = {};
    hashMapAlpha = {};
    hashMapBeta = {};
    adoptedStyleSheets = {};
    animations = {};
    state: PlaybackState = null;
    stylesToApply: { [id: string] : string[] } = {};
    BackgroundImageEligibleElements = ['DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE', 'NAV', 'SPAN', 'P', 'MAIN'];
    MaskedBackgroundImageStyle = `#CCC no-repeat center url("${Asset.Hide}")`;
    vNext: boolean;
    locale: string;

    constructor(state: PlaybackState, isMobile = false, vNext = false, locale = 'en-us') {
        this.state = state;
        this.isMobile = isMobile;
        this.vNext = vNext;
        this.locale = locale;
    }

    public reset = (): void => {
        this.nodes = {};
        this.stylesheets = [];
        this.fonts = [];
        this.events = {};
        this.hashMapAlpha = {};
        this.hashMapBeta = {};
        this.primaryHtmlNodeId = null;
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

    public element = (nodeId: number): Node | null => {
        return nodeId !== null && nodeId > 0 && nodeId in this.nodes ? this.nodes[nodeId] : null;
    }

    public animateChange = (event: DecodedLayout.AnimationEvent): void => {
        let animation: Animation = this.animations[event.data.id];
        if (!animation && event.data.operation !== AnimationOperation.Create) {
            // We didn't have a reference to this animation. This shouldn't happen, but returning here
            // to ensure we don't throw any errors.
            return;
        }
        switch(event.data.operation) {
            case AnimationOperation.Create:
                let target = this.element(event.data.targetId);
                // only create the animation if we successfully found the target, an animation without a target will throw an error
                if (target) {
                    this.animations[event.data.id] = (target as HTMLElement).animate(JSON.parse(event.data.keyFrames), JSON.parse(event.data.timing));
                }
                break;
            case AnimationOperation.Cancel:
                animation.cancel();
                break;
            case AnimationOperation.Finish:
                animation.finish();
                break;
            case AnimationOperation.Pause:
                animation.pause();
                break;
            case AnimationOperation.Play:
                animation.play();
                break;
            case AnimationOperation.CommitStyles:
                animation.commitStyles();
                break;
        }
    }

    public dom = async (event: DecodedLayout.DomEvent, useproxy?: LinkHandler): Promise<void> => {
        if (event) {
            // When setting up rendering for the first time, start off with hidden target window
            // This ensures we do not show flickers to the end user
            let doc = this.state.window.document;
            if (doc && doc.documentElement) {
                doc.documentElement.style.visibility = Constant.Hidden;
                // Render all DOM events to reconstruct the page
                this.markup(event, useproxy);
                // Wait on all stylesheets and fonts to finish loading
                await Promise.all(this.stylesheets.concat(this.fonts));
                // Toggle back the visibility of target window
                doc.documentElement.style.visibility = Constant.Visible;
            }
        }
    }

    public styleChange = (event: DecodedLayout.StyleSheetEvent): void => {
        switch (event.event) {
            case Data.Event.StyleSheetUpdate:
                let styleSheet: CSSStyleSheet = this.adoptedStyleSheets[event.data.id];
                if (!styleSheet && event.data.operation !== StyleSheetOperation.Create) {
                    return;
                }
                switch (event.data.operation) {
                    case StyleSheetOperation.Create:
                        this.adoptedStyleSheets[event.data.id] = new (this.state.window as any).CSSStyleSheet();
                        break;
                    case StyleSheetOperation.Replace:
                        styleSheet.replace(event.data.cssRules);
                        break;
                    case StyleSheetOperation.ReplaceSync:
                        styleSheet.replaceSync(event.data.cssRules);
                        break;
                }
                break;
            case Data.Event.StyleSheetAdoption:
                this.setDocumentStyles(event.data.id as number, event.data.newIds);
                break;
        }
    }

    public customElement = (event: DecodedLayout.CustomElementEvent): void => {
        const tagName = event.data.name;
        if (!this.state.window.customElements.get(tagName)) {
            try {
                // Use eval to create class in target window context (avoids ES5 transpilation issues)
                const EmptyElement = (this.state.window as any).eval(
                    '(class extends HTMLElement { constructor() { super(); } })'
                );
                this.state.window.customElements.define(tagName, EmptyElement);
            } catch (e) {
                console.error(`Failed to define custom element ${tagName}:`, e);
            }
        }
    }

    private setDocumentStyles(documentId: number, styleIds: string[]) {
        let targetDocument = documentId === -1 ? this.state.window.document : this.element(documentId) as Document;

        if (!targetDocument) {
            if (!this.stylesToApply[documentId]) {
                this.stylesToApply[documentId] = [];
            }
            this.stylesToApply[documentId] = styleIds;
            return;
        }

        let newSheets: CSSStyleSheet[] = [];
        for (var styleId of styleIds) {
            let styleSheet = this.adoptedStyleSheets[styleId];
            if (styleSheet) {
                newSheets.push(styleSheet);
            }
        }
        targetDocument.adoptedStyleSheets = newSheets
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

    public markup = (event: DecodedLayout.DomEvent, useproxy?: LinkHandler): void => {
        let data = event.data;
        let type = event.event;
        let doc = this.state.window.document;
        let retryEvent: DecodedLayout.DomEvent = {
            data: [],
            time: event.time,
            event: event.event
        }
        for (let node of data) {
            let parent = this.element(node.parent);
            let pivot = this.element(node.previous);
            let insert = this.insertAfter;

            let tag = node.tag;
            if (tag && tag.indexOf(Layout.Constant.IFramePrefix) === 0) { tag = node.tag.substr(Layout.Constant.IFramePrefix.length); }
            if (parent === null && node.parent !== null && node.parent > -1 && tag !== "HTML") {
                // We are referencing a parent for this node that hasn't been created yet. Push it to a list of nodes to
                // try once we are finished with other nodes within this event. Though we don't require HTML tags to
                // have a parent as they are typically the root.
                retryEvent.data.push(node);
                continue;
            }
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
                        this.nodes[node.id] = shadowRoot;
                        this.addToHashMap(node, shadowRoot);
                        this.addStyles(node.id);
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
                    if (this.primaryHtmlNodeId === null) {
                        this.primaryHtmlNodeId = node.id;
                    }
                    let isIframe = tag !== node.tag;
                    // when we see multiple HTML nodes in the same document we should treat subsequent ones as child elements
                    // rather than redefining our visualization base on them. It's technically illegal HTML but enough sites have
                    // this structure that we are robust against it.
                    if (this.primaryHtmlNodeId !== node.id && !isIframe) {
                        this.insertDefaultElement(node, parent, pivot, doc, insert);
                        break;
                    }
                    let htmlDoc = isIframe ? (parent ? (parent as HTMLIFrameElement).contentDocument : null): doc;
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
                        custom.setAttribute(Constant.CustomStyleTag, "true");
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
                    this.setAttributes(linkElement, node);
                    if ("rel" in node.attributes) {
                        if (node.attributes["rel"] === Constant.StyleSheet) {
                            this.stylesheets.push(new Promise((resolve: () => void): void => {
                                const proxy = useproxy ?? this.state.options.useproxy;
                                if (proxy) {
                                    if (linkElement.integrity) {
                                        linkElement.removeAttribute('integrity');
                                    }

                                    linkElement.href = proxy(linkElement.href, linkElement.id, Constant.StyleSheet);
                                }
                                linkElement.onload = linkElement.onerror = this.style.bind(this, linkElement, resolve);
                                setTimeout(resolve, LayoutHelper.TIMEOUT);
                            }));
                        } else if ((node.attributes["rel"].includes("preload") || node.attributes["rel"].includes("preconnect"))
                            && (node.attributes?.as === "style" || node.attributes?.as === "font")) {
                                this.fonts.push(new Promise((resolve: () => void): void => {
                                    const proxy = useproxy ?? this.state.options.useproxy;
                                    linkElement.href = proxy ? proxy(linkElement.href, linkElement.id, node.attributes.as) : linkElement.href;
                                    linkElement.onload = linkElement.onerror = this.style.bind(this, linkElement, resolve);
                                    setTimeout(resolve, LayoutHelper.TIMEOUT);
                                }));
                            }
                    }
                    insert(node, parent, linkElement, pivot);
                    break;
                case Layout.Constant.ImageTag:
                    let imgElement = this.element(node.id) as HTMLImageElement ?? this.createElement(doc, node.tag) as HTMLImageElement;
                    const proxy = useproxy ?? this.state.options.useproxy;
                    if (proxy && !!node.attributes?.src) {
                        node.attributes.src = proxy(node.attributes.src, node.attributes.id, Layout.Constant.ImageTag);
                    }
                    this.setAttributes(imgElement, node);
                    this.resize(imgElement, node.width, node.height);
                    insert(node, parent, imgElement, pivot);
                    break;
                case "STYLE":
                    let styleElement = this.element(node.id) as HTMLStyleElement ?? doc.createElement(node.tag) as HTMLStyleElement;
                    this.setAttributes(styleElement, node);
                    styleElement.textContent = node.value;
                    insert(node, parent, styleElement, pivot);
                    this.style(styleElement);
                    break;
                case "IFRAME":
                    let iframeElement = this.element(node.id) as HTMLIFrameElement;
                    iframeElement = iframeElement ? iframeElement : this.createElement(doc, node.tag) as HTMLIFrameElement;
                    if (!node.attributes) { node.attributes = {}; }
                    this.setAttributes(iframeElement, node);
                    insert(node, parent, iframeElement, pivot);
                    break;
                case "SCRIPT":
                    {
                        node.id = -1; // We want to ensure children of script tags are not processed
                        node.value = null; // We don't want to set any potential script content
                        this.insertDefaultElement(node, parent, pivot, doc, insert);
                        break;
                    }
                default:
                    this.insertDefaultElement(node, parent, pivot, doc, insert);
                    break;
            }
            // Track state for this node
            if (node.id) { this.events[node.id] = node; }
        }
        // only retry failed nodes if we are still making positive progress. If we have the same number of
        // nodes we started with, then we would just be spinning on an orphaned subtree.
        if (retryEvent.data.length > 0 && retryEvent.data.length !== event.data.length) {
            this.markup(retryEvent, useproxy);
        }
    }

    private insertDefaultElement = (node: DecodedLayout.DomData, parent: Node, pivot: Node, doc: Document, insert: (data: DecodedLayout.DomData, parent: Node, node: Node, previous: Node) => void): void => {
        let domElement = this.element(node.id) as HTMLElement;
        domElement = domElement ? domElement : this.createElement(doc, node.tag);
        this.setAttributes(domElement as HTMLElement, node);
        this.resize(domElement, node.width, node.height);
        insert(node, parent, domElement, pivot);
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

    private addStyles = (id: number): void => {
        let adoptedStylesToAdd = this.stylesToApply[id];
        if (adoptedStylesToAdd && adoptedStylesToAdd.length > 0) {
            this.setDocumentStyles(id, this.stylesToApply[id]);
            delete this.stylesToApply[id];
        }
    }

    private createElement = (doc: Document, tag: string): HTMLElement => {
        if (tag && tag.indexOf(Layout.Constant.SvgPrefix) === 0) {
            return doc.createElementNS(Layout.Constant.SvgNamespace as string, tag.substr(Layout.Constant.SvgPrefix.length)) as HTMLElement;
        }
        try {
            return doc.createElement(tag);
        } catch (ex) {
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
            if((child.nextSibling as HTMLElement)?.hasAttribute('clarity-custom-styles')){
                // Keep the custom style tag on top of the head to let client tags override its values.
                return child.nextSibling.nextSibling;
            }
            return child.nextSibling;
        }
        return child;
    }


    // Mask images within a masked ancestor element in the node has a background image.
    private mask = (node: HTMLElement) => {
        if (node && this.BackgroundImageEligibleElements.includes(node.nodeName) && 'getComputedStyle' in window && 'closest' in node) {
            const urlPattern = /url\(['"]?([^'")]+)['"]?\)/;
            const computedStyles = window.getComputedStyle(node);
            const hasBackgroundImage = computedStyles.backgroundImage?.match(urlPattern) || computedStyles.background?.match(urlPattern);
            const masked = node.closest?.(`[${LayoutConstants.MaskData}]`);

            if (hasBackgroundImage && masked) {
                node.style.background = this.MaskedBackgroundImageStyle;
            }
        }
    };

    private insertBefore = (data: DecodedLayout.DomData, parent: Node, node: Node, next: Node): void => {
        if (parent !== null) {
            // Compare against both parentNode and parentElement to ensure visualization works correctly for shadow DOMs
            next = next && (next.parentElement !== parent && next.parentNode !== parent) ? null : next;
            try {
                parent.insertBefore(node, next);
                this.mask(node as HTMLElement);
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
                    } else if (tag === Constant.ImageTag && attribute.indexOf("src") === 0 && ((v === null || v.length === 0 || v?.startsWith('blob:')))) {
                        if (this.vNext) {
                            if (v.startsWith('blob:')) { 
                                if (data.width >= Setting.LargeSvg && data.height >= Setting.LargeSvg) {
                                    node.setAttribute(Constant.BlobUnavailable, `${Constant.Large}${Constant.Beta}`);
                                } else {
                                    node.setAttribute(Constant.BlobUnavailable, `${Constant.Small}${Constant.Beta}`);
                                }
                            } else {
                                if (data.width >= Setting.LargeSvg && data.height >= Setting.LargeSvg) {
                                    node.setAttribute(Constant.Hide, `${Constant.Large}${Constant.Beta}`);
                                } else {
                                    node.setAttribute(Constant.Hide, `${Constant.Small}${Constant.Beta}`);
                                }
                            }
                        } else {
                                node.setAttribute(attribute, Asset.Transparent);
                                let size = Constant.Large;
                                if (data.width) {
                                    size = data.width <= Setting.Medium ? Constant.Medium : (data.width <= Setting.Small ? Constant.Small : size);
                                }
                                node.setAttribute(Constant.Hide, size);
                        }
                    } else {
                        node.setAttribute(attribute, this.isSuspiciousAttribute(attribute, v) ? Constant.Empty : v);
                    }
                } catch (ex) {
                    console.warn("Node: " + node + " | " + JSON.stringify(attributes));
                    console.warn("Exception encountered while adding attributes: " + ex);
                }
            }
        }

        if (sameorigin === false && tag === Constant.IFrameTag && typeof node.setAttribute === Constant.Function) {
            if (this.svgFitsText(node)) {
                node.setAttribute(Constant.Unavailable, Layout.Constant.Empty);
            } else {
                node.setAttribute(Constant.UnavailableSmall, Layout.Constant.Empty);
            }
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

    private isSuspiciousAttribute(name: string, value: string): boolean {
        // Block event handlers entirely
        if (name.startsWith('on')) {
            return true;
        }
        
        // Check for JavaScript protocols and dangerous patterns
        const dangerous = [
            /^\s*javascript:/i,
            /^\s*data:text\/html/i,
            /^\s*vbscript:/i
        ];
        
        return dangerous.some(pattern => pattern.test(value));
    }


    private getMobileCustomStyle = (): string => {
        if(this.isMobile){
            return `*{scrollbar-width: none; scrollbar-gutter: unset;};`
        }

        return '';
    }

    private getCustomStyle = (): string => {
        return this.getImageHiddenCss() +
            this.getIframeUnavailableCss() +
            this.getBlobUnavailableCss() +
            this.getBackgroundCss() +
            `*[${Constant.Suspend}] { filter: grayscale(100%); }` +
            `body { font-size: initial; }
            ${this.getMobileCustomStyle()}`;
    }

    private svgFitsText = (inputElement: HTMLElement): boolean => {
        var dimensions = inputElement.getBoundingClientRect();
        if (dimensions.width >= Setting.LargeSvg && dimensions.height >= Setting.LargeSvg) {
            return true;
        }
        return false;
    }

    private getIframeUnavailableCss = (): string => {
        if (this.vNext) {
            return `${Constant.IFrameTag}[${Constant.UnavailableSmall}] { ${iframeUnavailableSvgSmall} }` +
                    `${Constant.IFrameTag}[${Constant.Unavailable}] { ${iframeUnavailableSvg[this.locale]} }`;
        } else {
            return `${Constant.IFrameTag}[${Constant.Unavailable}] { background: url(${Asset.Unavailable}) no-repeat center center, url('${Asset.Cross}'); }`;
        }
    }

    private getBlobUnavailableCss = (): string => {
        if (this.vNext) {
            return  `${Constant.ImageTag}[${Constant.BlobUnavailable}=${Constant.Small}${Constant.Beta}] { ${blobUnavailableSvgSmall} }` +
                    `${Constant.ImageTag}[${Constant.BlobUnavailable}=${Constant.Large}${Constant.Beta}] { ${blobUnavailableSvg[this.locale]} }`;
        }
        return '';
    }

    private getImageHiddenCss = (): string => {
        if (this.vNext) {
            return  `${Constant.ImageTag}[${Constant.Hide}=${Constant.Small}${Constant.Beta}] { ${imageMaskedSvgSmall} }` +
                    `${Constant.ImageTag}[${Constant.Hide}=${Constant.Large}${Constant.Beta}] { ${imageMaskedSvg[this.locale]} }`;
        } else {
            return  `${Constant.ImageTag}[${Constant.Hide}] { background-color: #CCC; background-image: url(${Asset.Hide}); background-repeat:no-repeat; background-position: center; }` +
                    `${Constant.ImageTag}[${Constant.Hide}=${Constant.Small}] { background-size: 18px 18px; }` +
                    `${Constant.ImageTag}[${Constant.Hide}=${Constant.Medium}] { background-size: 24px 24px; }` +
                    `${Constant.ImageTag}[${Constant.Hide}=${Constant.Large}] { background-size: 36px 36px; }`;
        }
    }

    private getBackgroundCss = (): string => {
        if (this.vNext) {
            return sharedStyle;
        }
        return '';
    }
}
