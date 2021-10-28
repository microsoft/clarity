import { Privacy } from "@clarity-types/core";
import { BooleanFlag } from "@clarity-types/data";

/* Enum */

export const enum Source {
    Discover,
    ChildListAdd,
    ChildListRemove,
    Attributes,
    CharacterData
}

export const enum Selector {
    Stable = 0,
    Beta = 1
}

export const enum InteractionState {
    None = 16,
    Clicked = 20,
    Input = 30
}

export const enum RegionVisibility {
    Rendered = 0,
    Visible = 10,
    ScrolledToEnd = 13
}

export const enum Constant {
    Empty = "",
    SvgPrefix = "svg:",
    DataPrefix = "data:",
    IFramePrefix = "iframe:",
    SvgNamespace = "http://www.w3.org/2000/svg",
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
    BodyTag = "BODY",
    SvgTag = "svg:svg",
    BaseTag = "BASE",
    NativeCode = "[native code]",
    DocumentTag = "*D",
    ShadowDomTag = "*S",
    PolyfillShadowDomTag = "*P",
    TextTag = "*T",
    SuspendMutationTag = "*M",
    ChildList = "childList",
    Attributes = "attributes",
    CharacterData = "characterData",
    Suspend = "suspend",
    LoadEvent = "load",
    Pixel = "px",
    BorderBox = "border-box",
    Value = "value",
    MutationObserver = "MutationObserver",
    Zone = "Zone",
    Symbol = "__symbol__",
    JsonLD = "application/ld+json",
    String = "string",
    Number = "number",
    Disable = "disable",
    HTML = "HTML",
    Property = "property",
    Content = "content",
    Generator = "generator",
    ogType = "og:type",
    ogTitle = "og:title"
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
    Posting = "posting",
    Headline = "headline",
    Creator = "creator"
}

export const enum Setting {
    LookAhead = 33, // 33ms
    MutationSuspendThreshold = 10, // Stop listening for mutations after hitting a threshold count
    MutationActivePeriod = 3000 // Unit: milliseconds. Let mutations continue as normal during active periods of user interactions
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

export interface SelectorInput {
    tag: string;
    prefix: [string, string];
    position: number;
    attributes: Attributes;
}

export interface NodeInfo {
    tag: string;
    attributes?: Attributes;
    value?: string;
}

export interface NodeValue {
    id: number;
    parent: number;
    previous: number;
    children: number[];
    data: NodeInfo;
    selector: [string, string];
    hash: [string, string];
    region: number;
    metadata: NodeMeta;
}

export interface NodeMeta {
    active: boolean;
    suspend: boolean;
    privacy: Privacy;
    position: number;
    size: number[];
}

export interface MutationQueue {
    time: number;
    mutations: MutationRecord[];
}

export interface MutationHistory {
    [key: string]: [/* Count */ number, /* Remove Nodes Buffer */ NodeList?];
}

export interface RegionQueue {
    node: Node;
    data: RegionData;
}

export interface RegionState {
    time: number;
    data: RegionData;
}

/* Event Data */

export interface DocumentData {
    width: number;
    height: number;
}

export interface RegionData {
    id: number;
    visibility: RegionVisibility;
    interaction: InteractionState;
    name: string;    
}

export interface BoxData {
    id: number;
    width: number;
    height: number;
}

export interface TargetMetadata {
    id: number;
    hash: [string, string];
    privacy: Privacy;
    node: Node;
}
