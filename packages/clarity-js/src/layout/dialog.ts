// Dialog coverage is intentionally limited to painted, rectangular modal panes.
// It changes exposure, not intersection membership or interaction capture.
type Rect = { left: number; top: number; right: number; bottom: number };
type Pane = { node: Element; owner: Element; rect: Rect };
const selector = 'dialog,[role="dialog"][aria-modal="true"],[role="alertdialog"][aria-modal="true"]';
const events = ["scroll", "resize", "transitionrun", "transitionend", "transitioncancel", "animationstart", "animationend", "animationcancel"];
let dialogs: Set<Element> = new Set();
let roots: Set<Document | ShadowRoot> = new Set();
let resize: ResizeObserver = null;
let callback: () => void = null;
let timer: number = null;
let panes: Pane[] = [];
let modal = false;
let animations: Set<Element> = new Set();

export function start(change: () => void): void {
    stop();
    callback = change;
    modal = typeof CSS !== "undefined" && CSS.supports("selector(:modal)");
    resize = window.ResizeObserver ? new ResizeObserver(schedule) : null;
    window.addEventListener("resize", schedule, { passive: true });
    document.addEventListener("visibilitychange", visibility);
}

export function observe(root: Document | ShadowRoot): void {
    if (!callback || roots.has(root) || root.ownerDocument && root.ownerDocument !== document) { return; }
    roots.add(root);
    events.forEach(name => root.addEventListener(name, schedule, { capture: true, passive: true }));
    discover(root);
}

export function watch(node: Element): void {
    if (resize) { resize.observe(node); }
}

export function unwatch(node: Element): void {
    if (resize && !dialogs.has(node)) { resize.unobserve(node); }
}

function discover(root: ParentNode): void {
    root.querySelectorAll(selector).forEach(add);
}

function add(node: Element): void {
    if (!dialogs.has(node) && dialogs.size < 128) {
        dialogs.add(node);
        if (resize) { resize.observe(node); }
        schedule();
    }
}

export function update(records: MutationRecord[]): void {
    if (!callback) { return; }
    for (let record of records) {
        if (record.type === "attributes" && record.target.nodeType === Node.ELEMENT_NODE) {
            let node = record.target as Element;
            if (node.matches(selector)) { add(node); }
        }
        record.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                let element = node as Element;
                if (element.matches(selector)) { add(element); }
                discover(element);
            }
        });
    }
    if (dialogs.size) { schedule(); }
}

function visibility(): void {
    if (timer !== null) { window.clearTimeout(timer); timer = null; }
    if (callback) { callback(); }
    if (document.visibilityState !== "hidden") { schedule(); }
}

function schedule(event?: globalThis.Event | ResizeObserverEntry[]): void {
    if (event && "target" in event && event.target instanceof Element && animations.size < 64 &&
        /^(transition|animation)/.test(event.type)) { animations.add(event.target); }
    if (callback && timer === null && dialogs.size && document.visibilityState !== "hidden") {
        timer = window.setTimeout(sample, 100);
    }
}

function sample(): void {
    timer = null;
    if (!callback) { return; }
    callback();
    // Inspect tracked surfaces/animation targets, not every descendant or document animation.
    let moving = false;
    dialogs.forEach(node => {
        if (node.getAnimations && node.getAnimations().some(a => a.playState === "running")) { moving = true; }
    });
    panes.forEach(pane => {
        if (pane.node.getAnimations && pane.node.getAnimations().some(a => a.playState === "running")) { moving = true; }
    });
    animations.forEach(node => {
        if (node.isConnected && node.getAnimations && node.getAnimations().some(a => a.playState === "running")) {
            moving = true;
        } else { animations.delete(node); }
    });
    if (moving) { schedule(); }
}

export function refresh(): void {
    panes = [];
    dialogs.forEach(node => {
        if (!node.isConnected) {
            dialogs.delete(node);
            if (resize) { resize.unobserve(node); }
        } else if (node.matches(selector) && (node.localName !== "dialog" || modal && node.matches(":modal"))) {
            let anchor = clipped(node);
            if (!anchor) { return; }
            let viewport = viewportRect();
            // Native modal backdrops live in the top layer, outside the dialog's element box.
            if (node.localName === "dialog") {
                let backdrop = getComputedStyle(node, "::backdrop");
                if (panes.length < 32 && painted(backdrop) && rectangular(backdrop) && Number(backdrop.opacity) > 0 &&
                    backdrop.visibility === "visible" && backdrop.position === "fixed" &&
                    [backdrop.left, backdrop.top, backdrop.right, backdrop.bottom].every(value => value === "0px")) {
                    panes.push({ node, owner: node, rect: viewport });
                }
            }
            // A painted viewport-sized sibling below the modal is an associated backdrop,
            // including overlays next to a dialog inside an open shadow root.
            let siblings = node.parentNode ? (node.parentNode as ParentNode).children : null;
            if (siblings && siblings.length <= 64) {
                for (let sibling of Array.from(siblings)) {
                    if (sibling === node || panes.length >= 32) { continue; }
                    let style = getComputedStyle(sibling);
                    if (style.position !== "fixed" || !painted(style)) { continue; }
                    let bounds = clipped(sibling, true);
                    let inset = [style.left, style.top, style.right, style.bottom].every(value => value === "0px");
                    let overlap = bounds ? intersection(anchor, bounds) : null;
                    if (bounds && (inset || bounds.left === viewport.left && bounds.top === viewport.top &&
                        bounds.right === viewport.right && bounds.bottom === viewport.bottom) &&
                        overlap && foreground(node, sibling, overlap)) {
                        panes.push({ node: sibling, owner: node, rect: bounds });
                    }
                }
            }
            // A transparent modal wrapper is not itself a content pane. Bound descendant work.
            let candidates = [node];
            if (!painted(getComputedStyle(node))) {
                let walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
                let children: Element[] = [];
                let child = walker.nextNode();
                while (child && children.length <= 64) {
                    children.push(child as Element);
                    child = walker.nextNode();
                }
                if (children.length <= 64) { candidates = candidates.concat(children); }
            }
            for (let candidate of candidates) {
                if (panes.length >= 32) { break; }
                let style = getComputedStyle(candidate);
                let rect = painted(style) ? clipped(candidate, true) : null;
                if (rect) { panes.push({ node: candidate, owner: node, rect }); }
            }
        }
    });
    roots.forEach(root => {
        if ("host" in root && !root.host.isConnected) {
            events.forEach(name => root.removeEventListener(name, schedule, true));
            roots.delete(root);
        }
    });
}

function painted(style: CSSStyleDeclaration): boolean {
    let color = style.backgroundColor;
    // Computed rgb()/rgba() colors include translucent panes, without treating images as solid paint.
    return /^rgb\(/.test(color) || /^rgba\(/.test(color) && !/,\s*0(?:\.0*)?\s*\)$/.test(color);
}

function parent(node: Element): Element {
    return node.parentElement || ((node.getRootNode() as ShadowRoot).host || null);
}

function contains(ancestor: Element, node: Element): boolean {
    for (let current = node; current; current = parent(current)) {
        if (current === ancestor) { return true; }
    }
    return false;
}

function intersection(a: Rect, b: Rect): Rect {
    let r = { left: Math.max(a.left, b.left), top: Math.max(a.top, b.top),
        right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) };
    return r.right > r.left && r.bottom > r.top ? r : null;
}

function viewportRect(): Rect {
    return { left: 0, top: 0, right: document.documentElement.clientWidth, bottom: document.documentElement.clientHeight };
}

function rectangular(style: CSSStyleDeclaration): boolean {
    let mask = style.getPropertyValue("mask-image");
    let rotate = style.getPropertyValue("rotate");
    let scale = style.getPropertyValue("scale");
    return style.borderRadius === "0px" && style.clipPath === "none" && style.filter === "none" &&
        style.perspective === "none" && (!mask || mask === "none") && (!rotate || rotate === "none") &&
        (!scale || scale === "none") && (style.transform === "none" || /^matrix\(1,\s*0,\s*0,\s*1,/.test(style.transform));
}

function clipped(node: Element, pane: boolean = false): Rect {
    let rect = intersection(node.getBoundingClientRect(), viewportRect());
    for (let current = node; current && rect; current = parent(current)) {
        let style = getComputedStyle(current);
        if (style.display === "none" || style.visibility !== "visible" || Number(style.opacity) === 0 || style.filter !== "none" ||
            style.perspective !== "none" || style.getPropertyValue("rotate") && style.getPropertyValue("rotate") !== "none" ||
            style.getPropertyValue("scale") && style.getPropertyValue("scale") !== "none" ||
            style.clipPath !== "none" || style.getPropertyValue("mask-image") !== "none" &&
            style.getPropertyValue("mask-image") !== "" || style.transform !== "none" &&
            !/^matrix\(1,\s*0,\s*0,\s*1,/.test(style.transform)) { return null; }
        if (pane && current === node && style.borderRadius !== "0px") { return null; }
        if (current !== node && /(hidden|clip|scroll|auto)/.test(style.overflowX + style.overflowY)) {
            if (style.borderRadius !== "0px") { return null; }
            let bounds = current.getBoundingClientRect();
            rect = intersection(rect, {
                left: /(hidden|clip|scroll|auto)/.test(style.overflowX) ? bounds.left + current.clientLeft : rect.left,
                right: /(hidden|clip|scroll|auto)/.test(style.overflowX) ?
                    bounds.left + current.clientLeft + current.clientWidth : rect.right,
                top: /(hidden|clip|scroll|auto)/.test(style.overflowY) ? bounds.top + current.clientTop : rect.top,
                bottom: /(hidden|clip|scroll|auto)/.test(style.overflowY) ?
                    bounds.top + current.clientTop + current.clientHeight : rect.bottom
            });
        }
    }
    return rect;
}

function stack(root: Document | ShadowRoot, x: number, y: number, depth: number = 0,
               budget: { remaining: number } = { remaining: 128 }): Element[] {
    let result: Element[] = [];
    if (!root.elementsFromPoint || depth > 16) { return result; }
    for (let element of root.elementsFromPoint(x, y).slice(0, 64)) {
        if (budget.remaining-- <= 0) { break; }
        if (element.getRootNode() !== root) { continue; }
        if (element.shadowRoot) { result = result.concat(stack(element.shadowRoot, x, y, depth + 1, budget)); }
        result.push(element);
    }
    return result;
}

function foreground(pane: Element, region: Element, rect: Rect): boolean {
    // Verify paint order at the center and just inside each corner of the overlap.
    let dx = Math.min(1, (rect.right - rect.left) / 4);
    let dy = Math.min(1, (rect.bottom - rect.top) / 4);
    let points = [[(rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2],
        [rect.left + dx, rect.top + dy], [rect.right - dx, rect.top + dy],
        [rect.left + dx, rect.bottom - dy], [rect.right - dx, rect.bottom - dy]];
    return points.every(point => {
        for (let node of stack(document, point[0], point[1])) {
            if (contains(pane, node)) { return true; }
            if (contains(region, node)) { return false; }
        }
        return false;
    });
}

export function covered(region: Element): boolean {
    if (!panes.length || region.ownerDocument !== document) { return false; }
    let rect = clipped(region);
    if (!rect) { return false; }
    let remaining = [rect];
    for (let pane of panes) {
        if (contains(pane.owner, region) || contains(region, pane.node)) { continue; }
        let overlap = intersection(rect, pane.rect);
        if (!overlap || !foreground(pane.node, region, overlap)) { continue; }
        let next: Rect[] = [];
        for (let part of remaining) {
            let cut = intersection(part, overlap);
            if (!cut) { next.push(part); continue; }
            if (part.left < cut.left) { next.push({ ...part, right: cut.left }); }
            if (part.right > cut.right) { next.push({ ...part, left: cut.right }); }
            if (part.top < cut.top) { next.push({ left: cut.left, right: cut.right, top: part.top, bottom: cut.top }); }
            if (part.bottom > cut.bottom) { next.push({ left: cut.left, right: cut.right, top: cut.bottom, bottom: part.bottom }); }
        }
        remaining = next;
        if (!remaining.length) { return true; }
        if (remaining.length > 128) { return false; }
    }
    return false;
}

export function stop(): void {
    if (timer !== null) { window.clearTimeout(timer); }
    roots.forEach(root => events.forEach(name => root.removeEventListener(name, schedule, true)));
    window.removeEventListener("resize", schedule);
    document.removeEventListener("visibilitychange", visibility);
    if (resize) { resize.disconnect(); }
    resize = null;
    timer = null;
    callback = null;
    dialogs = new Set();
    roots = new Set();
    panes = [];
    animations = new Set();
}
