/* Enum */

export const enum Source {
    Discover,
    ChildListAdd,
    ChildListRemove,
    Attributes,
    CharacterData
}

export const enum Constant {
    Empty = "",
    SvgPrefix = "svg:",
    DataPrefix = "data:",
    IFramePrefix = "iframe:",
    SvgNamespace = "http://www.w3.org/2000/svg",
    DevHook = "__CLARITY_DEVTOOLS_HOOK__",
    Id = "id",
    Class = "class",
    Href = "href",
    Src = "src",
    Srcset = "srcset",
    MaskData = "data-clarity-mask",
    UnmaskData = "data-clarity-unmask",
    RegionData = "data-clarity-region",
    Type = "type",
    Name = "name",
    Base = "*B",
    SameOrigin = "*O",
    Object = "object",
    Function = "function",
    InputTag = "INPUT",
    IFrameTag = "IFRAME",
    BaseTag = "BASE",
    NativeCode = "[native code]",
    DocumentTag = "*D",
    ShadowDomTag = "*S",
    PolyfillShadowDomTag = "*P",
    TextTag = "*T",
    ChildList = "childList",
    Attributes = "attributes",
    CharacterData = "characterData",
    LoadEvent = "load"
}

export const enum JsonLD { 
    ScriptType = "application/ld+json",
    Type = "@type",
    Recipe = "recipe",
    Product = "product",
    Rating = "aggregaterating",
    Author = "person",
    Offer = "offer",
    Brand = "brand",
    RatingValue = "ratingValue",
    RatingCount = "ratingCount",
    Availability = "availability",
    Name = "name"
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
