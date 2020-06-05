/* Enum */

export const enum Source {
    Discover,
    ChildListAdd,
    ChildListRemove,
    Attributes,
    CharacterData
}

export const enum Constant {
    EMPTY_STRING = "",
    SVG_PREFIX = "svg:",
    DATA_PREFIX = "data:",
    IFRAME_PREFIX = "iframe:",
    SVG_NAMESPACE = "http://www.w3.org/2000/svg",
    DEVTOOLS_HOOK = "__CLARITY_DEVTOOLS_HOOK__",
    CLARITY_REGION_ATTRIBUTE = "data-clarity-region",
    ID_ATTRIBUTE = "id",
    CLASS_ATTRIBUTE = "class",
    HREF_ATTRIBUTE = "href",
    SRC_ATTRIBUTE = "src",
    SRCSET_ATTRIBUTE = "srcset",
    MASK_ATTRIBUTE = "data-clarity-mask",
    UNMASK_ATTRIBUTE = "data-clarity-unmask",
    TYPE_ATTRIBUTE = "type",
    NAME_ATTRIBUTE = "name",
    BASE_ATTRIBUTE = "*B",
    SAME_ORIGIN_ATTRIBUTE = "*O",
    FUNCTION = "function",
    INPUT_TAG = "INPUT",
    IFRAME_TAG = "IFRAME",
    BASE_TAG = "BASE",
    NATIVE_CODE = "[native code]",
    DOCUMENT_TAG = "*D",
    SHADOW_DOM_TAG = "*S",
    POLYFILL_SHADOWDOM_TAG = "*P",
    TEXT_TAG = "*T",
    CHILD_LIST = "childList",
    ATTRIBUTES = "attributes",
    CHARACTER_DATA = "characterData",
    LOAD_EVENT = "load",
    PLACEHOLDER_SELECTOR = "*?",
    DISCONNECTED_SELECTOR = "*!"
}


/* Helper Interfaces */

export interface Attributes {
    [key: string]: string;
}

export interface NodeInfo {
    tag: string;
    path?: string;
    attributes?: Attributes;
    value?: string;
}

export interface NodeValue {
    id: number;
    parent: number;
    previous: number;
    position: number;
    children: number[];
    data: NodeInfo;
    selector: string;
    region: number;
    metadata: NodeMeta;
}

export interface NodeMeta {
    active: boolean;
    region: boolean;
    masked: boolean;
}

export interface NodeChange {
    time: number;
    source: Source;
    value: NodeValue;
}

export interface MutationQueue {
    time: number;
    mutations: MutationRecord[];
}

/* Event Data */

export interface DocumentData {
    width: number;
    height: number;
}

export interface RegionData {
    id: number;
    box: number[];
    region: string;
}
