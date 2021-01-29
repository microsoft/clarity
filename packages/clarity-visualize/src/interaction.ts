import { Asset, Constant, Point, Setting } from "@clarity-types/visualize";
import { Data, Interaction, Layout  } from "clarity-decode";
import { state } from "./clarity";
import { element } from "./layout";

const CLARITY_CLICK = "clarity-click";
const CLARITY_POINTER = "clarity-pointer";
const CLARITY_TOUCH = "clarity-touch";
const CLARITY_HOVER = "clarity-hover";
const CLARITY_POINTER_CLICK = "clarity-pointer-click";
const CLARITY_POINTER_NONE = "clarity-pointer-none";
const CLARITY_POINTER_MOVE = "clarity-pointer-move";
const CLARITY_CLICK_RING = "clarity-click-ring";
const CLARITY_TOUCH_RING = "clarity-touch-ring";
const TITLE = "title";
const ROUND = "round";
const TRAIL_START_COLOR = [242,97,12]; // rgb(242,97,12)
const TRAIL_END_COLOR = [249,220,209]; // rgb(249,220,209)

let hoverId: number = null;
let targetId: number = null;
let points: Point[] = [];
let scrollPointIndex = 0;
let clickAudio = null;

export function reset(): void {
    points = [];
    scrollPointIndex = 0;
    clickAudio = null;
    hoverId = null;
    targetId = null;
}

export function scroll(event: Interaction.ScrollEvent): void {
    let data = event.data;
    let doc = state.player.contentDocument;
    let de = doc.documentElement;
    let scrollTarget = element(data.target as number) as HTMLElement || doc.body;
    let scrollable = scrollTarget.scrollHeight > scrollTarget.clientHeight;
    if (scrollTarget && scrollable) { scrollTarget.scrollTo(data.x, data.y); }

    // Position canvas relative to scroll events on the parent page
    if (scrollTarget === de || scrollTarget === doc.body) {
        if (!scrollable) {window.scrollTo(data.x, data.y);}
        let canvas = overlay();
        if (canvas) {
            canvas.style.left = data.x + Constant.Pixel;
            canvas.style.top = data.y + Constant.Pixel;
            canvas.width = de.clientWidth;
            canvas.height = de.clientHeight;
        }
        scrollPointIndex = points.length;
    }
}

export function resize(event: Interaction.ResizeEvent): void {
    let data = event.data;
    let width = data.width;
    let height = data.height;
    if (state.onresize) {
        state.onresize(width, height);
    }
}

export function visibility(event: Interaction.VisibilityEvent): void {
    if (state.player && event.data.visible !== Constant.Visible) {
        state.player.style.backgroundColor = Constant.Black;
        state.player.style.opacity = Constant.HiddenOpacity;
    } else {
        state.player.style.backgroundColor = Constant.Transparent;
        state.player.style.opacity = Constant.VisibleOpacity;
    }
}

export function input(event: Interaction.InputEvent): void {
    let data = event.data;
    let el = element(data.target as number) as HTMLInputElement;
    if (el) {
        switch (el.type) {
            case "checkbox":
            case "radio":
                el.checked = data.value === "true";
                break;
            default:
                el.value = data.value;
                break;
        }
    }
}

export function selection(event: Interaction.SelectionEvent): void {
    let data = event.data;
    let doc = state.player.contentDocument;
    let s = doc.getSelection();
    // Wrapping selection code inside a try / catch to avoid throwing errors when dealing with elements inside the shadow DOM.
    try { s.setBaseAndExtent(element(data.start as number), data.startOffset, element(data.end as number), data.endOffset); } catch (ex) {
        console.warn("Exception encountered while trying to set selection: " + ex);
    }
}

export function pointer(event: Interaction.PointerEvent): void {
    let data = event.data;
    let type = event.event;
    let doc = state.player.contentDocument;
    let de = doc.documentElement;
    let p = doc.getElementById(CLARITY_POINTER);
    let pointerWidth = Setting.PointerWidth;
    let pointerHeight = Setting.PointerHeight;

    if (p === null) {
        p = doc.createElement("DIV");
        p.id = CLARITY_POINTER;
        de.appendChild(p);

        // Add custom styles
        let style = doc.createElement("STYLE");
        style.innerText =
            "@keyframes pulsate-one { 0% { transform: scale(1, 1); opacity: 1; } 100% { transform: scale(3, 3); opacity: 0; } }" +
            "@keyframes pulsate-two { 0% { transform: scale(1, 1); opacity: 1; } 100% { transform: scale(5, 5); opacity: 0; } }" +
            "@keyframes pulsate-touch { 0% { transform: scale(1, 1); opacity: 1; } 100% { transform: scale(2, 2); opacity: 0; } }" +
            "@keyframes disappear { 90% { transform: scale(1, 1); opacity: 1; } 100% { transform: scale(1.3, 1.3); opacity: 0; } }" +
            `#${Constant.InteractionCanvas} { position: absolute; left: 0; top: 0; z-index: ${Setting.ZIndex} }` +
            `#${CLARITY_POINTER} { position: absolute; z-index: ${Setting.ZIndex}; url(${Asset.Pointer}) no-repeat left center; width: ${pointerWidth}px; height: ${pointerHeight}px; }` +
            `.${CLARITY_CLICK}, .${CLARITY_CLICK_RING}, .${CLARITY_TOUCH}, .${CLARITY_TOUCH_RING} { position: absolute; z-index: ${Setting.ZIndex}; border-radius: 50%; background: radial-gradient(rgba(0,90,158,0.8), transparent); width: ${Setting.ClickRadius}px; height: ${Setting.ClickRadius}px;}` +
            `.${CLARITY_CLICK_RING} { background: transparent; border: 1px solid rgba(0,90,158,0.8); }` +
            `.${CLARITY_TOUCH} { background: radial-gradient(rgba(242,97,12,1), transparent); }` +
            `.${CLARITY_TOUCH_RING} { background: transparent; border: 1px solid rgba(242,97,12,0.8); }` +
            `.${CLARITY_POINTER_CLICK} { background-image: url(${Asset.Click}); }` +
            `.${CLARITY_POINTER_NONE} { background: none; }` +
            `.${CLARITY_POINTER_MOVE} { background-image: url(${Asset.Pointer}); }`;

        p.appendChild(style);
    }

    p.style.left = (data.x - Setting.PointerOffset) + Constant.Pixel;
    p.style.top = (data.y - Setting.PointerOffset) + Constant.Pixel;
    let title = "Pointer"
    switch (type) {
        case Data.Event.Click:
        case Data.Event.DoubleClick:
            title = "Click";
            drawClick(doc, data.x, data.y, title);
            p.className = CLARITY_POINTER_NONE;
            break;
        case Data.Event.TouchStart:
        case Data.Event.TouchEnd:
        case Data.Event.TouchCancel:
            title = "Touch";
            drawTouch(doc, data.x, data.y, title);
            p.className = CLARITY_POINTER_NONE;
            break;
        case Data.Event.TouchMove:
            title = "Touch Move";
            p.className = CLARITY_POINTER_NONE;
            break;
        case Data.Event.MouseMove:
            title = "Mouse Move";
            p.className = CLARITY_POINTER_MOVE;
            addPoint({time: event.time, x: data.x, y: data.y});
            targetId = data.target as number;
            break;
        default:
            p.className = CLARITY_POINTER_MOVE;
            break;
    }
    p.setAttribute(TITLE, `${title} (${data.x}${Constant.Pixel}, ${data.y}${Constant.Pixel})`);
}

function hover(): void {
    if (targetId && targetId !== hoverId) {
        let depth = 0;
        // First, remove any previous hover class assignments
        let hoverNode = hoverId ? element(hoverId) as HTMLElement : null;
        while (hoverNode && depth < Setting.HoverDepth) {
            if ("removeAttribute" in hoverNode) { hoverNode.removeAttribute(CLARITY_HOVER); }
            hoverNode = hoverNode.parentElement;
            depth++;
        }
        // Then, add hover class on elements that are below the pointer
        depth = 0;
        let targetNode = targetId ? element(targetId) as HTMLElement : null;
        while (targetNode && depth < Setting.HoverDepth) {
            if ("setAttribute" in targetNode) { targetNode.setAttribute(CLARITY_HOVER, Layout.Constant.Empty); }
            targetNode = targetNode.parentElement;
            depth++;
        }
        // Finally, update hoverId to reflect the new node
        hoverId = targetId;
    }
}

function addPoint(point: Point): void {
    let last = points.length > 0 ? points[points.length-1] : null;
    if (last && point.x === last.x && point.y === last.y) {
        last.time = point.time;
    } else { points.push(point); }
}

function drawTouch(doc: Document, x: number, y: number, title: string): void {
    let de = doc.documentElement;
    let touch = doc.createElement("DIV");
    touch.className = CLARITY_TOUCH;
    touch.setAttribute(TITLE, `${title} (${x}${Constant.Pixel}, ${y}${Constant.Pixel})`);
    touch.style.left = (x - Setting.ClickRadius / 2) + Constant.Pixel;
    touch.style.top = (y - Setting.ClickRadius / 2) + Constant.Pixel
    touch.style.animation = "disappear 1 1s";
    touch.style.animationFillMode = "forwards";
    de.appendChild(touch);

    // First pulsating ring
    let ringOne = touch.cloneNode() as HTMLElement;
    ringOne.className = CLARITY_TOUCH_RING;
    ringOne.style.left = "-0.5" + Constant.Pixel;
    ringOne.style.top = "-0.5" + Constant.Pixel;
    ringOne.style.animation = "pulsate-touch 1 1s";
    ringOne.style.animationFillMode = "forwards";
    touch.appendChild(ringOne);
}

function drawClick(doc: Document, x: number, y: number, title: string): void {
    let de = doc.documentElement;
    let click = doc.createElement("DIV");
    click.className = CLARITY_CLICK;
    click.setAttribute(TITLE, `${title} (${x}${Constant.Pixel}, ${y}${Constant.Pixel})`);
    click.style.left = (x - Setting.ClickRadius / 2) + Constant.Pixel;
    click.style.top = (y - Setting.ClickRadius / 2) + Constant.Pixel
    de.appendChild(click);

    // First pulsating ring
    let ringOne = click.cloneNode() as HTMLElement;
    ringOne.className = CLARITY_CLICK_RING;
    ringOne.style.left = "-0.5" + Constant.Pixel;
    ringOne.style.top = "-0.5" + Constant.Pixel;
    ringOne.style.animation = "pulsate-one 1 1s";
    ringOne.style.animationFillMode = "forwards";
    click.appendChild(ringOne);

    // Second pulsating ring
    let ringTwo = ringOne.cloneNode() as HTMLElement;
    ringTwo.style.animation = "pulsate-two 1 1s";
    click.appendChild(ringTwo);

    // Play sound
    if (clickAudio === null) { clickAudio = new Audio(Asset.Sound); }
    clickAudio.play();
}

function overlay(): HTMLCanvasElement {
    // Create canvas for visualizing interactions
    let doc = state.player.contentDocument;
    let de = doc.documentElement;
    let canvas = doc.getElementById(Constant.InteractionCanvas) as HTMLCanvasElement;
    if (canvas === null) {
        canvas = document.createElement("canvas");
        canvas.id = Constant.InteractionCanvas;
        canvas.width = 0;
        canvas.height = 0;
        de.appendChild(canvas);
    }

    if (canvas.width !== de.clientWidth || canvas.height !== de.clientHeight) {
        canvas.width = de.clientWidth;
        canvas.height = de.clientHeight;
    }

    return canvas;
}

function match(time: number): Point[] {
    let p = [];
    for (let i = points.length - 1; i > 0; i--) {
        // Each pixel in the trail has a pixel life of 3s. The only exception to this is if the user scrolled.
        // We reset the trail after every scroll event to avoid drawing weird looking trail.
        if (i >= scrollPointIndex && time - points[i].time < Setting.PixelLife) {
            p.push(points[i]);
        } else { break; }
    }
    return p.slice(0, Setting.MaxTrailPoints);
}

export function trail(now: number): void {
    const canvas = overlay();
    if (canvas) {
        const ctx = canvas.getContext('2d');
        const path = curve(match(now));
        // Update hovered elements
        hover();
        // We need at least two points to create a line
        if (path.length > 1) {
            let last = path[0];
            // Start off by clearing whatever was on the canvas before
            // The current implementation is inefficient. We have to redraw canvas all over again for every point.
            // In future we should batch pointer events and minimize the number of times we have to redraw canvas.
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            let count = path.length;
            let offsetX = canvas.offsetLeft;
            let offsetY = canvas.offsetTop;
            for (let i = 1; i < count; i++) {
                let current = path[i];

                // Compute percentage position of these points compared to all points in the path
                let lastFactor = 1 - ((i-1)/count);
                let currentFactor = 1 - (i/count);

                // Generate a color gradient that goes from red -> yellow -> green -> light blue -> blue
                let gradient = ctx.createLinearGradient(last.x, last.y, current.x, current.y);
                gradient.addColorStop(1, color(currentFactor))
                gradient.addColorStop(0, color(lastFactor))

                // Line width of the trail shrinks as the position of the point goes farther away.
                ctx.lineWidth = Setting.TrailWidth * currentFactor;
                ctx.lineCap = ROUND;
                ctx.lineJoin = ROUND;
                ctx.strokeStyle = gradient;
                ctx.beginPath();

                // The coordinates need to be relative to where canvas is rendered.
                // In case of scrolling on the page, canvas may be relative to viewport
                // while trail points are relative to screen origin (0, 0). We make the adjustment so trail looks right.
                ctx.moveTo(last.x - offsetX, last.y - offsetY);
                ctx.lineTo(current.x - offsetX, current.y - offsetY);
                ctx.stroke();
                ctx.closePath();
                last = current;
            }
        }
    }
}

function color(factor: number): string {
    let s = TRAIL_START_COLOR;
    let e = TRAIL_END_COLOR;
    let c = [];
    for (let i = 0; i < 3; i++) { c[i] = Math.round(e[i] + factor * (s[i] - e[i])); }
    return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${factor})`;
}

// Reference: https://en.wikipedia.org/wiki/Cubic_Hermite_spline#Cardinal_spline
function curve(path: Point[]): Point[] {
    const tension = 0.5;
    let p = [];
    let output = [];

    // Make a copy of the input points so we don't make any side effects
    p = path.slice(0);
    // The algorithm require a valid previous and next point for each point in the original input
    // Duplicate first and last point in the path to the beginning and the end of the array respectively
    // E.g. [{x:37,y:45}, {x:54,y:34}] => [{x:37,y:45}, {x:37,y:45}, {x:54,y:34}, {x:54,y:34}]
    p.unshift(path[0]);
    p.push(path[path.length - 1]);
    // Loop through the points, and generate intermediate points to make a smooth trail
      for (let i = 1; i < p.length-2; i++) {
        const time = p[i].time;
        const segments = Math.max(Math.min(Math.round(distance(p[i], p[i-1])), 10), 1);
        for (let t = 0; t <= segments; t++) {

            // Compute tension vectors
            let t1: Point = {time, x: (p[i+1].x - p[i-1].x) * tension, y: (p[i+1].y - p[i-1].y) * tension};
            let t2: Point = {time, x: (p[i+2].x - p[i].x) * tension, y: (p[i+2].y - p[i].y) * tension};
            let step = t / segments;

            // Compute cardinals
            let c1 = 2 * Math.pow(step, 3) - 3 * Math.pow(step, 2) + 1;
            let c2 = -(2 * Math.pow(step, 3)) + 3 * Math.pow(step, 2);
            let c3 = Math.pow(step, 3) - 2 * Math.pow(step, 2) + step;
            let c4 = Math.pow(step, 3) - Math.pow(step, 2);

            // Compute new point with common control vectors
            let x = c1 * p[i].x + c2 * p[i+1].x + c3 * t1.x + c4 * t2.x;
            let y = c1 * p[i].y + c2 * p[i+1].y + c3 * t1.y + c4 * t2.y;

            output.push({time,x,y});
        }
    }
    return output;
}

function distance(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx*dx + dy*dy);
}
