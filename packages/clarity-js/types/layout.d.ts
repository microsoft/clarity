import { Privacy } from "@clarity-types/core";

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
    Box = "#",
    Period = ".",
    MaskData = "data-clarity-mask",
    UnmaskData = "data-clarity-unmask",
    RegionData = "data-clarity-region",
    Type = "type",
    Submit = "submit",
    Name = "name",
    Base = "*B",
    SameOrigin = "*O",
    Object = "object",
    Function = "function",
    StyleTag = "STYLE",
    InputTag = "INPUT",
    IFrameTag = "IFRAME",
    ImageTag = "IMG",
    TitleTag = "TITLE",
    SvgTag = "svg:svg",
    BaseTag = "BASE",
    NativeCode = "[native code]",
    DocumentTag = "*D",
    ShadowDomTag = "*S",
    PolyfillShadowDomTag = "*P",
    TextTag = "*T",
    ChildList = "childList",
    Attributes = "attributes",
    CharacterData = "characterData",
    LoadEvent = "load",
    Pixel = "px",
    BorderBox = "border-box",
    Value = "value",
    MutationObserver = "MutationObserver",
    Zone = "Zone",
    Symbol = "__symbol__",
    JsonLD = "application/ld+json",
    String = "string",
    Number = "number"
}

export const enum JsonLD { 
    Type = "@type",
    Recipe = "recipe",
    Product = "product",
    AggregateRating = "aggregaterating",
    Author = "person",
    Offer = "offer",
    Brand = "brand",
    RatingValue = "ratingValue",
    BestRating = "bestRating",
    WorstRating = "worstRating",
    RatingCount = "ratingCount",
    ReviewCount = "reviewCount",
    Availability = "availability",
    Price = "price",
    PriceCurrency = "priceCurrency",
    ItemCondition = "itemCondition",
    Category = "category",
    Sku = "sku",
    Name = "name",
    Article = "article",
    Posting = "posting"
}

export const enum Setting {
    LookAhead = 33, // 33ms
}

/* Helper Interfaces */
export interface Box {
    x: number; // Left
    y: number; // Top
    w: number; // Width
    h: number; // Height
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
    privacy: Privacy;
    size: number[];
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

export interface RegionQueue {
    node: Node;
    data: RegionData;
}

/* Event Data */

export interface DocumentData {
    width: number;
    height: number;
}

export interface RegionData {
    id: number;
    visible: number;
    region: string;
}

export interface BoxData {
    id: number;
    width: number;
    height: number;
}

export interface TargetMetadata {
    id: number;
    region: number;
    hash: string;
    privacy: Privacy;
    selector: string;
    node: Node;
}
