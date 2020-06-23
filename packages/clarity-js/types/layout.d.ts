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
    OBJECT = "object",
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

export const enum JsonLD { 
    SCRIPT_TYPE = "application/ld+json",
    TYPE_KEY = "@type",
    RECIPE_TYPE = "recipe",
    PRODUCT_TYPE = "product",
    RATING_TYPE = "aggregaterating",
    AUTHOR_TYPE = "person",
    OFFER_TYPE = "offer",
    BRAND_TYPE = "brand",
    RATING_VALUE_KEY = "ratingValue",
    RATING_COUNT_KEY = "ratingCount",
    AVAILABILITY_KEY = "availability",
    NAME_KEY = "name"
}


/* Helper Interfaces */
export interface Box {
    x: number; // Left
    y: number; // Top
    w: number; // Width
    h: number; // Height
    v: number; // Visibility
}

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
    box: Box;
    region: string;
}
