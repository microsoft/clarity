import { Constant, Source } from "@clarity-types/layout";
import { Code, Severity } from "@clarity-types/data";
import config from "@src/core/config";
import * as dom from "./dom";
import * as log from "@src/diagnostic/log";
import * as interaction from "@src/interaction";
import * as mutation from "@src/layout/mutation";

const IGNORE_ATTRIBUTES = ["title", "alt", "onload", "onfocus", "onerror"];

export default function(node: Node, source: Source): Node {
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
            let docTypePrefix = insideFrame ? Constant.IFRAME_PREFIX : Constant.EMPTY_STRING;
            let doctype = node as DocumentType;
            let docAttributes = { name: doctype.name, publicId: doctype.publicId, systemId: doctype.systemId };
            let docData = { tag: docTypePrefix + Constant.DOCUMENT_TAG, attributes: docAttributes };
            dom[call](node, parent, docData, source);
            break;
        case Node.DOCUMENT_NODE:
            observe(node);
            break;
        case Node.DOCUMENT_FRAGMENT_NODE:
            let shadowRoot = (node as ShadowRoot);
            if (shadowRoot.host) {
                let type = typeof(shadowRoot.constructor);
                if (type === Constant.FUNCTION && shadowRoot.constructor.toString().indexOf(Constant.NATIVE_CODE) >= 0) {
                    observe(shadowRoot);
                    // See: https://wicg.github.io/construct-stylesheets/ for more details on adoptedStyleSheets.
                    // At the moment, we are only able to capture "open" shadow DOM nodes. If they are closed, they are not accessible.
                    // In future we may decide to proxy "attachShadow" call to gain access, but at the moment, we don't want to
                    // cause any unintended side effect to the page. We will re-evaluate after we gather more real world data on this.
                    let style = Constant.EMPTY_STRING as string;
                    let adoptedStyleSheets: CSSStyleSheet[] = "adoptedStyleSheets" in shadowRoot ? shadowRoot["adoptedStyleSheets"] : [];
                    for (let styleSheet of adoptedStyleSheets) { style += getCssRules(styleSheet); }
                    let fragementData = { tag: Constant.SHADOW_DOM_TAG, attributes: { style } };
                    dom[call](node, shadowRoot.host, fragementData, source);
                } else {
                    // If the browser doesn't support shadow DOM natively, we detect that, and send appropriate tag back.
                    // The differentiation is important because we don't have to observe pollyfill shadow DOM nodes,
                    // the same way we observe real shadow DOM nodes (encapsulation provided by the browser).
                    dom[call](node, shadowRoot.host, { tag: Constant.POLYFILL_SHADOWDOM_TAG, attributes: {} }, source);
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
                let textData = { tag: Constant.TEXT_TAG, value: node.nodeValue };
                dom[call](node, parent, textData, source);
            }
            break;
        case Node.ELEMENT_NODE:
            let element = (node as HTMLElement);
            let tag = element.tagName;
            parent = node.parentNode ? node.parentNode as HTMLElement : null;
            // If we encounter a node that is part of SVG namespace, prefix the tag with SVG_PREFIX
            if (element.namespaceURI === Constant.SVG_NAMESPACE) { tag = Constant.SVG_PREFIX + tag; }

            switch (tag) {
                case "HTML":
                    parent = insideFrame && parent ? dom.iframe(parent) : null;
                    let htmlPrefix = insideFrame ? Constant.IFRAME_PREFIX : Constant.EMPTY_STRING;
                    let htmlData = { tag: htmlPrefix + tag, attributes: getAttributes(element.attributes) };
                    dom[call](node, parent, htmlData, source);
                    break;
                case "SCRIPT":
                case "NOSCRIPT":
                case "META":
                    break;
                case "HEAD":
                    let head = { tag, attributes: getAttributes(element.attributes) };
                    if (location) { head.attributes[Constant.BASE_ATTRIBUTE] = location.protocol + "//" + location.hostname; }
                    dom[call](node, parent, head, source);
                    break;
                case "STYLE":
                    let attributes = getAttributes(element.attributes);
                    let styleData = { tag, attributes, value: getStyleValue(element as HTMLStyleElement) };
                    dom[call](node, parent, styleData, source);
                    break;
                case "IFRAME":
                    let iframe = node as HTMLIFrameElement;
                    let frameData = { tag, attributes: getAttributes(iframe.attributes) };
                    if (dom.sameorigin(iframe)) {
                        mutation.monitor(iframe);
                        frameData.attributes[Constant.SAME_ORIGIN_ATTRIBUTE] = "true";
                        if (iframe.contentDocument && iframe.contentWindow && iframe.contentDocument.readyState !== "loading") {
                            child = iframe.contentDocument;
                        }
                    }
                    dom[call](node, parent, frameData, source);
                    break;
                default:
                    let data = { tag, attributes: getAttributes(element.attributes) };
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
    let value = style.textContent;
    if (value.length === 0 || config.cssRules) {
        value = getCssRules(style.sheet as CSSStyleSheet);
    }
    return value;
}

function getCssRules(sheet: CSSStyleSheet): string {
    let value = Constant.EMPTY_STRING as string;
    let cssRules = null;
    // Firefox throws a SecurityError when trying to access cssRules of a stylesheet from a different domain
    try { cssRules = sheet ? sheet.cssRules : []; } catch (e) {
        log.log(Code.CssRules, e, Severity.Warning);
        if (e.name !== "SecurityError") { throw e; }
    }

    if (cssRules !== null) {
        for (let i = 0; i < cssRules.length; i++) {
            value += cssRules[i].cssText;
        }
    }

    return value;
}

function getAttributes(attributes: NamedNodeMap): {[key: string]: string} {
    let output = {};
    if (attributes && attributes.length > 0) {
        for (let i = 0; i < attributes.length; i++) {
            let name = attributes[i].name;
            if (IGNORE_ATTRIBUTES.indexOf(name) < 0) {
                output[name] = attributes[i].value;
            }
        }
    }
    return output;
}
