// Full-page covers only. Unknown foreground ordering retains exposure rather than sampling pixels.
type Cover = { owner: Element; node: Element; native: boolean; level: number };
const selector = 'dialog,[role="dialog"][aria-modal="true"],[role="alertdialog"][aria-modal="true"]';
const events = ["transitionrun", "transitionend", "animationstart", "animationend", "toggle", "fullscreenchange"];
let modals: Set<Element> = new Set();
let roots: Set<Document | ShadowRoot> = new Set();
let covers: Cover[] = [];
let nativeRoots: Element[] = [];
let callback: () => void = null;
let timer: number = null;
let native = false;
let popover = false;

export function start(change: () => void): void {
    stop();
    callback = change;
    native = typeof CSS !== "undefined" && CSS.supports("selector(:modal)");
    popover = typeof CSS !== "undefined" && CSS.supports("selector(:popover-open)");
    window.addEventListener("resize", schedule, true);
    document.addEventListener("visibilitychange", visibility);
}

export function observe(root: Document | ShadowRoot): void {
    if (!callback || roots.has(root) || root.ownerDocument && root.ownerDocument !== document) { return; }
    roots.add(root);
    events.forEach(name => root.addEventListener(name, schedule, true));
    root.querySelectorAll(selector).forEach(add);
}

function add(node: Element): void {
    if (node.ownerDocument === document && modals.size < 64) { modals.add(node); schedule(); }
}

export function update(records: MutationRecord[]): void {
    if (!callback) { return; }
    for (let record of records) {
        if (record.target.nodeType === Node.ELEMENT_NODE && (record.target as Element).matches(selector)) {
            add(record.target as Element);
        }
        record.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                let element = node as Element;
                if (element.matches(selector)) { add(element); }
                element.querySelectorAll(selector).forEach(add);
            }
        });
    }
    if (modals.size) { schedule(); }
}

function schedule(): void {
    if (callback && timer === null && document.visibilityState !== "hidden") {
        timer = window.setTimeout(() => { timer = null; if (callback) { callback(); } }, 100);
    }
}

function visibility(): void {
    if (timer !== null) { window.clearTimeout(timer); timer = null; }
    if (callback && document.visibilityState !== "hidden") { callback(); }
}

function parent(node: Element): Element {
    return node.assignedSlot || node.parentElement || (node.getRootNode() as ShadowRoot).host || null;
}

function related(a: Element, b: Element): boolean {
    for (let node = b; node; node = parent(node)) { if (node === a) { return true; } }
    return false;
}

// Only these well-defined stacking contexts are used as proof that descendants cannot escape.
function context(node: Element, style: CSSStyleDeclaration): boolean {
    let container = parent(node);
    return style.display !== "contents" && (style.position === "fixed" || style.position === "sticky" || style.opacity !== "1" ||
        style.transform !== "none" || style.isolation === "isolate" || style.zIndex !== "auto" &&
        (style.position !== "static" || container && /^(inline-)?(flex|grid)$/.test(getComputedStyle(container).display)));
}

function simple(style: CSSStyleDeclaration): boolean {
    return ["clip-path", "mask-image", "filter", "backdrop-filter", "perspective", "rotate", "scale", "translate"]
        .every(key => !style.getPropertyValue(key) || style.getPropertyValue(key) === "none") &&
        style.clip === "auto" && style.mixBlendMode === "normal" && style.willChange === "auto" && style.contain === "none" &&
        (!style.getPropertyValue("content-visibility") || style.getPropertyValue("content-visibility") === "visible");
}

function surface(style: CSSStyleDeclaration, width: number, height: number): boolean {
    let color = style.backgroundColor;
    return style.position === "fixed" && style.display !== "none" && style.visibility === "visible" &&
        Number(style.opacity) > 0 && style.transform === "none" && simple(style) &&
        style.borderRadius === "0px" && style.backgroundClip === "border-box" &&
        (/^rgb\(/.test(color) || /^rgba\(/.test(color) && !/,\s*0(?:\.0*)?\s*\)$/.test(color)) &&
        [style.left, style.top, style.right, style.bottom].every(value => value === "0px") &&
        parseFloat(style.width) >= width && parseFloat(style.height) >= height;
}

export function refresh(): void {
    covers = []; nativeRoots = [];
    if (document.visibilityState === "hidden" || document.fullscreenElement) { return; }
    // Undiscovered top-layer ordering is not inferred from point samples.
    for (let root of Array.from(roots)) {
        if ("host" in root && !root.host.isConnected) {
            events.forEach(name => root.removeEventListener(name, schedule, true)); roots.delete(root); continue;
        }
        if (popover && root.querySelector(":popover-open")) { return; }
    }
    let width = document.documentElement.clientWidth, height = document.documentElement.clientHeight;
    modals.forEach(owner => {
        if (!owner.isConnected) { modals.delete(owner); return; }
        if (!owner.matches(selector)) { return; }
        let top = native && owner.matches("dialog:modal");
        if (owner.localName === "dialog" && !top) { return; }
        if (top) { nativeRoots.push(owner); }
        let bounds = owner.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0 || getComputedStyle(owner).visibility !== "visible") { return; }
        if (top && covers.length < 64 && !(owner.getAnimations && owner.getAnimations().some(a => a.playState === "running")) &&
            surface(getComputedStyle(owner, "::backdrop"), width, height)) {
            covers.push({ owner, node: owner, native: true, level: 0 });
        }
        let siblings = owner.parentNode ? (owner.parentNode as ParentNode).children : null;
        for (let node of siblings && siblings.length <= 32 ? Array.from(siblings) : [owner]) {
            let style = getComputedStyle(node), level = Number(style.zIndex);
            if (!surface(style, width, height) || !(level > 0) ||
                node.getAnimations && node.getAnimations().some(a => a.playState === "running")) { continue; }
            let rect = node.getBoundingClientRect();
            if (rect.left > 0 || rect.top > 0 || rect.right < width || rect.bottom < height) { continue; }
            let rootLevel = true;
            for (let ancestor = parent(node); ancestor; ancestor = parent(ancestor)) {
                let value = getComputedStyle(ancestor);
                if (!simple(value) || context(ancestor, value) ||
                    /(hidden|clip|scroll|auto)/.test(value.overflowX + value.overflowY)) { rootLevel = false; break; }
            }
            if (rootLevel && (node === owner || parent(owner) === parent(node) &&
                getComputedStyle(owner).position === "fixed" && Number(getComputedStyle(owner).zIndex) > level)) {
                if (covers.length < 64) { covers.push({ owner, node, native: false, level }); }
            }
        }
    });
}

export function covered(region: Element): boolean {
    if (region.ownerDocument !== document || nativeRoots.some(node => related(node, region) || related(region, node))) { return false; }
    for (let cover of covers) {
        if (related(cover.owner, region) || related(region, cover.owner) || related(region, cover.node)) { continue; }
        if (cover.native) { return true; }
        let outer: CSSStyleDeclaration = null;
        let known = true;
        for (let node = region; node; node = parent(node)) {
            let style = getComputedStyle(node);
            if (!simple(style)) { known = false; break; }
            if (context(node, style)) { outer = style; }
        }
        // No enclosing context means a child can paint above the cover; leave the region exposed.
        if (known && outer && (outer.zIndex === "auto" ? 0 : Number(outer.zIndex)) < cover.level) { return true; }
    }
    return false;
}

export function stop(): void {
    if (timer !== null) { window.clearTimeout(timer); }
    roots.forEach(root => events.forEach(name => root.removeEventListener(name, schedule, true)));
    window.removeEventListener("resize", schedule, true);
    document.removeEventListener("visibilitychange", visibility);
    modals = new Set(); roots = new Set(); covers = []; nativeRoots = [];
    callback = null; timer = null;
}
