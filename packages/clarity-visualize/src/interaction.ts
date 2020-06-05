import { Point } from "@clarity-types/visualize";
import { Data, Interaction, Layout  } from "clarity-decode";
import { state } from "./clarity";
import { element } from "./layout";

// tslint:disable-next-line: max-line-length
const POINTER_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAoCAYAAACfKfiZAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAUoSURBVHgB7VddTBxVFD6zs2X5W3YXZ1uo/CyRQiVthKIpDzwAMSZqg4TIs9jW+lCSUtInrMBiH0gMohF50bAJvJCQtg8+iJC6Fow/EVYTIhBxQYWwoFLkR1jYn+s5d2eWmV2wVVliTE9ycu/cuXPOd8/57rlzAf5jIsAhiw60znU+n6+1pqZGjHgXc+HOc3NzDQwlGAzeXVpaegy7AhxGVGRH+vT09EQC0NzcTCB+nJyczMO+LuYgZCdHrFZrMgEgTPX19SwQCPw0PT1dgs+iPCdmwgGkpqamKABICwsL2ezsLPN6vddkXgih17EBEGexWEwKgFOnEpkgCCwnJ4eD2N7efoPmUCTklB08AFSzAuDVS0fZD98XMlu2gYNwOp0Md8iHw8PD1ljwIioCF85LbNaNKXAXcRAUDYWcc3NzJw4ahKgGQM4uXpDYZyOPM9/2Wbay/CS7euU4B6aAwLScVXgBByC0GgOoUkARuOvMxzQ8wVighKu9OYODq6qqYisrK2xzc/NaWVmZ/iA4oSsuLj6CrSYFw5/mM+ed/DAA0tu38pjFomc2m42Tc2tr68a/ARHe22NjY1EGBIEXKZif94bHql5IBdfoaex5oKKiAqampl4bGhq6PTIyIv2TyqkA4JvbbDYLauc6nQCiqIOZGa/mI5vNAM47BWA2/QJFRUXQ2dl5rrS09OuZmZlc5MjfAsEBIJl0IaeCpsoQCBry+xncu+ePAuEaOw31V9KgoaEB7HZ7Nm7Xodra2qdkew9UOTWTkFh7REDAFsDt3tzTQMdbNmhpehRaW1uhuro6OyUl5ePe3t6rCOKBIsEB9Pf3s8jJoYrLOBC9HmB1NQDLy/49jTQ1ZcCtmyfg228+AiSzyePxvNnT02NHct53m3IAmLeQtwhRoiCgEojp6T/2NUTkdH5SgL1FKC8v5+QcHBzscLlcEvxFOvTqByxEe5w0DNA/iDhzYyMIPb2/QjAIu3AF0ECvfUmCt9+Z5+Ts6Oiow1P1HFbOZzIzM91KkYN9IkFnQbgOUCX86ouTXL/8/CRWxXxWd9mqGOCtWtVjMiRN5cSI5MuVUyOCCgC9TEL/K2gEEAC8clEKxQBNLSz4oPpFN1RWVkJbWxtGIbhrBOeTiqLIVYesVcZoPbi9SX9fXV29hO1N/CS4VwoigrkrHo8PLtf9jFvPBu3t7TA6Ovry+Pj4HDpiOzs7gl4fMoOgGO6CALX0mJCQEKQ5SUlJfoPB4M/Ly/MS33DLan3JJ5vmNFSn4MyZRIbIeemdmJi4ge/TUY8ZjUYpLS3Nin3So8nJydRKCCIV20dQqTWjGlETUI/IkRY0EUCj+26V9z/4DVyuTXA43oP4+HgHFpt3cXgbNbC+vk7KMjIysFzPC7hSYWNjg62tralN8GgoLf3zRhFRJkecmZapisDr19N5v6Wlhf6IvkMHafhsQocJdHjRISQvQlT6kWOksn1x338IJQWg2gXPP2diRqOOH72Y57murq4SAkihlJ1wY6oDKKqvVriPRHGAVDly+/r6njWZTBYcS4RQHmPzT6gGoJDO7XbbiWyy8ziI0Y0pCoDD4WCLi4vdmPdjdF+A0B/Tgf2CaUThgHIvINLhXWACx46jpqDGx8p5OJwFBQXhwcbGxvnu7u7zGBE6fXZQ6RhUuBET4TcjSZKMFIGBgYGns7KywqSL9bVMAUBbK2lhYeE6tiYIVa64w3BOIlCxwDQQy2nVlHOlbB6OKFd02bH+sFYeKZEV7aH8/+VPXTO9DRqcKEgAAAAASUVORK5CYII=";
// tslint:disable-next-line: max-line-length
const CLICK_ICON = "data:image/png;base64,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";
// tslint:disable-next-line: max-line-length
const CLICK_SOUND = "data:video/webm;base64,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";

const CLARITY_CANVAS = "clarity-canvas";
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
const PIXEL = "px";

const config = {
    pointerWidth: 32,
    pointerHeight: 32,
    pointerOffsetX: 3,
    pointerOffsetY: 2,
    clickWidth: 22,
    clickHeight: 22,
    pixelLife: 3000,
    trailWidth: 6,
    maxTrailPoints: 75,
    zIndex: 10000000,
    hoverDepth: 3
}

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
    if (scrollTarget) { scrollTarget.scrollTo(data.x, data.y); }

    // Position canvas relative to scroll events on the parent page
    if (scrollTarget === de || scrollTarget === doc.body) {
        let canvas = overlay();
        if (canvas) {
            canvas.style.left = data.x + PIXEL;
            canvas.style.top = data.y + PIXEL;
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
    let p = doc.getElementById(CLARITY_POINTER);
    let pointerWidth = config.pointerWidth;
    let pointerHeight = config.pointerHeight;

    if (p === null) {
        p = doc.createElement("DIV");
        p.id = CLARITY_POINTER;
        doc.body.appendChild(p);

        // Add custom styles
        let style = doc.createElement("STYLE");
        style.innerText =
            "@keyframes pulsate-one { 0% { transform: scale(1, 1); opacity: 1; } 100% { transform: scale(3, 3); opacity: 0; } }" +
            "@keyframes pulsate-two { 0% { transform: scale(1, 1); opacity: 1; } 100% { transform: scale(5, 5); opacity: 0; } }" +
            "@keyframes pulsate-touch { 0% { transform: scale(1, 1); opacity: 1; } 100% { transform: scale(2, 2); opacity: 0; } }" +
            "@keyframes disappear { 90% { transform: scale(1, 1); opacity: 1; } 100% { transform: scale(1.3, 1.3); opacity: 0; } }" +
            `#${CLARITY_CANVAS} { position: absolute; left: 0; top: 0; z-index: ${config.zIndex} }` +
            `#${CLARITY_POINTER} { position: absolute; z-index: ${config.zIndex + 2}; url(${POINTER_ICON}) no-repeat left center; width: ${pointerWidth}px; height: ${pointerHeight}px; }` +
            `.${CLARITY_CLICK}, .${CLARITY_CLICK_RING}, .${CLARITY_TOUCH}, .${CLARITY_TOUCH_RING} { position: absolute; z-index: ${config.zIndex + 1}; border-radius: 50%; background: radial-gradient(rgba(255,0,0,0.8), transparent); width: ${config.clickWidth}px; height: ${config.clickHeight}px;}` +
            `.${CLARITY_CLICK_RING} { background: transparent; border: 1px solid rgba(255,0,0,0.8); }` +
            `.${CLARITY_TOUCH} { background: radial-gradient(rgba(255,255,0,1), transparent); }` +
            `.${CLARITY_TOUCH_RING} { background: transparent; border: 1px solid rgba(255,0,0,0.8); }` +
            `.${CLARITY_POINTER_CLICK} { background-image: url(${CLICK_ICON}); }` +
            `.${CLARITY_POINTER_NONE} { background: none; }` +
            `.${CLARITY_POINTER_MOVE} { background-image: url(${POINTER_ICON}); }`;

        p.appendChild(style);
    }

    p.style.left = (data.x - config.pointerOffsetX) + PIXEL;
    p.style.top = (data.y - config.pointerOffsetY) + PIXEL;
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
    p.setAttribute(TITLE, `${title} (${data.x}${PIXEL}, ${data.y}${PIXEL})`);
}

function hover(): void {
    if (targetId && targetId !== hoverId) {
        let depth = 0;
        // First, remove any previous hover class assignments
        let hoverNode = hoverId ? element(hoverId) as HTMLElement : null;
        while (hoverNode && depth < config.hoverDepth) {
            if ("removeAttribute" in hoverNode) { hoverNode.removeAttribute(CLARITY_HOVER); }
            hoverNode = hoverNode.parentElement;
            depth++;
        }
        // Then, add hover class on elements that are below the pointer
        depth = 0;
        let targetNode = targetId ? element(targetId) as HTMLElement : null;
        while (targetNode && depth < config.hoverDepth) {
            if ("setAttribute" in targetNode) { targetNode.setAttribute(CLARITY_HOVER, Layout.Constant.EMPTY_STRING); }
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
    let touch = doc.createElement("DIV");
    touch.className = CLARITY_TOUCH;
    touch.setAttribute(TITLE, `${title} (${x}${PIXEL}, ${y}${PIXEL})`);
    touch.style.left = (x - config.clickWidth / 2) + PIXEL;
    touch.style.top = (y - config.clickWidth / 2) + PIXEL
    touch.style.animation = "disappear 1 1s";
    touch.style.animationFillMode = "forwards";
    doc.body.appendChild(touch);

    // First pulsating ring
    let ringOne = touch.cloneNode() as HTMLElement;
    ringOne.className = CLARITY_TOUCH_RING;
    ringOne.style.left = "-0.5" + PIXEL;
    ringOne.style.top = "-0.5" + PIXEL;
    ringOne.style.animation = "pulsate-touch 1 1s";
    ringOne.style.animationFillMode = "forwards";
    touch.appendChild(ringOne);
}

function drawClick(doc: Document, x: number, y: number, title: string): void {
    let click = doc.createElement("DIV");
    click.className = CLARITY_CLICK;
    click.setAttribute(TITLE, `${title} (${x}${PIXEL}, ${y}${PIXEL})`);
    click.style.left = (x - config.clickWidth / 2) + PIXEL;
    click.style.top = (y - config.clickHeight / 2) + PIXEL
    doc.body.appendChild(click);

    // First pulsating ring
    let ringOne = click.cloneNode() as HTMLElement;
    ringOne.className = CLARITY_CLICK_RING;
    ringOne.style.left = "-0.5" + PIXEL;
    ringOne.style.top = "-0.5" + PIXEL;
    ringOne.style.animation = "pulsate-one 1 1s";
    ringOne.style.animationFillMode = "forwards";
    click.appendChild(ringOne);

    // Second pulsating ring
    let ringTwo = ringOne.cloneNode() as HTMLElement;
    ringTwo.style.animation = "pulsate-two 1 1s";
    click.appendChild(ringTwo);

    // Play sound
    if (clickAudio === null) { clickAudio = new Audio(CLICK_SOUND); }
    clickAudio.play();
}

function overlay(): HTMLCanvasElement {
    // Create canvas for visualizing interactions
    let doc = state.player.contentDocument;
    let de = doc.documentElement;
    let canvas = doc.getElementById(CLARITY_CANVAS) as HTMLCanvasElement;
    if (canvas === null) {
        canvas = document.createElement("canvas");
        canvas.id = CLARITY_CANVAS;
        canvas.width = 0;
        canvas.height = 0;
        doc.body.appendChild(canvas);
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
        if (i >= scrollPointIndex && time - points[i].time < config.pixelLife) {
            p.push(points[i]);
        } else { break; }
    }
    return p.slice(0, config.maxTrailPoints);
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
                ctx.lineWidth = config.trailWidth * currentFactor;
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
    let range: number = ((factor * 100) % 25) / 25.0;
    let r: number = 0;
    let g: number = 0;
    let b: number = 0;
    if (factor === 1) {
        r = 255;
    } else if (factor >= 0.75) {
        r = 255;
        g = Math.round(255 - 255 * range);
    } else if (factor >= 0.5) {
        r = Math.round(255 * range);
        g = 255;
    } else if (factor >= 0.25) {
        g = 255;
        b = Math.round(255 - 255 * range);
    } else {
        g = Math.round(255 * range);
        b = 255;
    }
    return `rgba(${r}, ${g}, ${b}, ${factor})`;
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
