import { Constant, Source } from "@clarity-types/layout";
import { Code, Dimension, Severity } from "@clarity-types/data";
import * as dom from "./dom";
import * as dimension from "@src/data/dimension";
import * as internal from "@src/diagnostic/internal";
import * as interaction from "@src/interaction";
import * as mutation from "@src/layout/mutation";
import * as schema from "@src/layout/schema";

const IGNORE_ATTRIBUTES = ["title", "alt", "onload", "onfocus", "onerror"];
const newlineRegex = /[\r\n]+/g;

export default function (node: Node, source: Source): Node {
    let child: Node = null;

    // Do not track this change if we are attempting to remove a node before discovering it
    if (source === Source.ChildListRemove && dom.has(node) === false) { return child; }

    // Special handling for text nodes that belong to style nodes
    if (source !== Source.Discover &&
        node.nodeType === Node.TEXT_NODE &&
        node.parentElement &&
        node.parentElement.tagName === "STYLE") {
        node = node.parentNode;
    }

    let add = dom.has(node) === false;
    let call = add ? "add" : "update";
    let parent = node.parentElement ? node.parentElement : null;
    let insideFrame = node.ownerDocument !== document;
    switch (node.nodeType) {
        case Node.DOCUMENT_TYPE_NODE:
            parent = insideFrame && node.parentNode ? dom.iframe(node.parentNode) : parent;
            let docTypePrefix = insideFrame ? Constant.IFramePrefix : Constant.Empty;
            let doctype = node as DocumentType;
            let docAttributes = { name: doctype.name, publicId: doctype.publicId, systemId: doctype.systemId };
            let docData = { tag: docTypePrefix + Constant.DocumentTag, attributes: docAttributes };
            dom[call](node, parent, docData, source);
            break;
        case Node.DOCUMENT_NODE:
            // We check for regions in the beginning when discovering document and
            // later whenever there are new additions or modifications to DOM (mutations)
            if (node === document) dom.parse(document);
            observe(node);
            break;
        case Node.DOCUMENT_FRAGMENT_NODE:
            let shadowRoot = (node as ShadowRoot);
            if (shadowRoot.host) {
                let type = typeof (shadowRoot.constructor);
                if (type === Constant.Function && shadowRoot.constructor.toString().indexOf(Constant.NativeCode) >= 0) {
                    observe(shadowRoot);
                    // See: https://wicg.github.io/construct-stylesheets/ for more details on adoptedStyleSheets.
                    // At the moment, we are only able to capture "open" shadow DOM nodes. If they are closed, they are not accessible.
                    // In future we may decide to proxy "attachShadow" call to gain access, but at the moment, we don't want to
                    // cause any unintended side effect to the page. We will re-evaluate after we gather more real world data on this.
                    let style = Constant.Empty as string;
                    let adoptedStyleSheets: CSSStyleSheet[] = "adoptedStyleSheets" in shadowRoot ? shadowRoot["adoptedStyleSheets"] : [];
                    for (let styleSheet of adoptedStyleSheets) { style += getCssRules(styleSheet); }
                    let fragementData = { tag: Constant.ShadowDomTag, attributes: { style } };
                    dom[call](node, shadowRoot.host, fragementData, source);
                } else {
                    // If the browser doesn't support shadow DOM natively, we detect that, and send appropriate tag back.
                    // The differentiation is important because we don't have to observe pollyfill shadow DOM nodes,
                    // the same way we observe real shadow DOM nodes (encapsulation provided by the browser).
                    dom[call](node, shadowRoot.host, { tag: Constant.PolyfillShadowDomTag, attributes: {} }, source);
                }
            }
            break;
        case Node.TEXT_NODE:
            // In IE11 TEXT_NODE doesn't expose a valid parentElement property. Instead we need to lookup parentNode property.
            parent = parent ? parent : node.parentNode as HTMLElement;
            // Account for this text node only if we are tracking the parent node
            // We do not wish to track text nodes for ignored parent nodes, like script tags
            // Also, we do not track text nodes for STYLE tags
            // The only exception is when we receive a mutation to remove the text node, in that case
            // parent will be null, but we can still process the node by checking it's an update call.
            if (call === "update" || (parent && dom.has(parent) && parent.tagName !== "STYLE")) {
                let textData = { tag: Constant.TextTag, value: node.nodeValue };
                dom[call](node, parent, textData, source);
            }
            break;
        case Node.ELEMENT_NODE:
            let element = (node as HTMLElement);
            let tag = element.tagName;
            let attributes = getAttributes(element);
            // In some cases, external libraries like vue-fragment, can modify parentNode property to not be in sync with the DOM
            // For correctness, we first look at parentElement and if it not present then fall back to using parentNode
            parent = node.parentElement ? node.parentElement : (node.parentNode ? node.parentNode as HTMLElement : null);
            // If we encounter a node that is part of SVG namespace, prefix the tag with SVG_PREFIX
            if (element.namespaceURI === Constant.SvgNamespace) { tag = Constant.SvgPrefix + tag; }

            switch (tag) {
                case "HTML":
                    parent = insideFrame && parent ? dom.iframe(parent) : null;
                    let htmlPrefix = insideFrame ? Constant.IFramePrefix : Constant.Empty;
                    let htmlData = { tag: htmlPrefix + tag, attributes };
                    dom[call](node, parent, htmlData, source);
                    break;
                case "SCRIPT":
                    if (Constant.Type in attributes && attributes[Constant.Type] === Constant.JsonLD) {
                        try {
                            schema.ld(JSON.parse((element as HTMLScriptElement).text.replace(newlineRegex, Constant.Empty)));
                        } catch { /* do nothing */ }
                    }
                    break;
                case "NOSCRIPT":
                    break;
                case "META":
                    var key = (Constant.Property in attributes ?
                                    Constant.Property : 
                                    (Constant.Name in attributes ? Constant.Name : null));
                    if (key && Constant.Content in attributes) {
                        let content = attributes[Constant.Content]
                        switch(attributes[key]) {
                            case Constant.ogTitle:
                                dimension.log(Dimension.MetaTitle, content)
                                break;
                            case Constant.ogType:
                                dimension.log(Dimension.MetaType, content)
                                break;
                            case Constant.Generator:
                                dimension.log(Dimension.Generator, content)
                                break;
                        }
                    }
                    break;
                case "HEAD":
                    let head = { tag, attributes };
                    if (location) { head.attributes[Constant.Base] = location.protocol + "//" + location.hostname; }
                    dom[call](node, parent, head, source);
                    break;
                case "STYLE":
                    let styleData = { tag, attributes, value: getStyleValue(element as HTMLStyleElement) };
                    dom[call](node, parent, styleData, source);
                    break;
                case "IFRAME":
                    let iframe = node as HTMLIFrameElement;
                    let frameData = { tag, attributes };
                    if (dom.sameorigin(iframe)) {
                        mutation.monitor(iframe);
                        frameData.attributes[Constant.SameOrigin] = "true";
                        if (iframe.contentDocument && iframe.contentWindow && iframe.contentDocument.readyState !== "loading") {
                            child = iframe.contentDocument;
                        }
                    }
                    dom[call](node, parent, frameData, source);
                    break;
                default:
                    let data = { tag, attributes };
                    if (element.shadowRoot) { child = element.shadowRoot; }
                    dom[call](node, parent, data, source);
                    break;
            }
            break;
        default:
            break;
    }
    return child;
}

function observe(root: Node): void {
    if (dom.has(root)) { return; }
    mutation.observe(root); // Observe mutations for this root node
    interaction.observe(root); // Observe interactions for this root node
}

function getStyleValue(style: HTMLStyleElement): string {
    // Call trim on the text content to ensure we do not process white spaces ( , \n, \r\n, \t, etc.)
    // Also, check if stylesheet has any data-* attribute, if so process rules instead of looking up text
    let value = style.textContent ? style.textContent.trim() : Constant.Empty;
    let dataset = style.dataset ? Object.keys(style.dataset).length : 0;
    if (value.length === 0 || dataset > 0) {
        value = getCssRules(style.sheet as CSSStyleSheet);
    }
    return value;
}

function getCssRules(sheet: CSSStyleSheet): string {
    let value = Constant.Empty as string;
    let cssRules = null;
    // Firefox throws a SecurityError when trying to access cssRules of a stylesheet from a different domain
    try { cssRules = sheet ? sheet.cssRules : []; } catch (e) {
        internal.log(Code.CssRules, Severity.Warning, e ? e.name : null);
        if (e && e.name !== "SecurityError") { throw e; }
    }

    if (cssRules !== null) {
        for (let i = 0; i < cssRules.length; i++) {
            value += cssRules[i].cssText;
        }
    }

    return value;
}

function getAttributes(element: HTMLElement): { [key: string]: string } {
    let output = {};
    let attributes = element.attributes;
    if (attributes && attributes.length > 0) {
        for (let i = 0; i < attributes.length; i++) {
            let name = attributes[i].name;
            if (IGNORE_ATTRIBUTES.indexOf(name) < 0) {
                output[name] = attributes[i].value;
            }
        }
    }

    // For INPUT tags read the dynamic "value" property if an explicit "value" attribute is not set
    if (element.tagName === Constant.InputTag && !(Constant.Value in output) && (element as HTMLInputElement).value) {
        output[Constant.Value] = (element as HTMLInputElement).value;
    }

    return output;
}
