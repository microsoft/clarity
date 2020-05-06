import { Data, Interaction  } from "clarity-decode";
import { element } from "./layout";

interface Point {
    time: number;
    x: number;
    y: number;
}

// tslint:disable-next-line: max-line-length
const POINTER_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAoCAYAAACfKfiZAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAUoSURBVHgB7VddTBxVFD6zs2X5W3YXZ1uo/CyRQiVthKIpDzwAMSZqg4TIs9jW+lCSUtInrMBiH0gMohF50bAJvJCQtg8+iJC6Fow/EVYTIhBxQYWwoFLkR1jYn+s5d2eWmV2wVVliTE9ycu/cuXPOd8/57rlzAf5jIsAhiw60znU+n6+1pqZGjHgXc+HOc3NzDQwlGAzeXVpaegy7AhxGVGRH+vT09EQC0NzcTCB+nJyczMO+LuYgZCdHrFZrMgEgTPX19SwQCPw0PT1dgs+iPCdmwgGkpqamKABICwsL2ezsLPN6vddkXgih17EBEGexWEwKgFOnEpkgCCwnJ4eD2N7efoPmUCTklB08AFSzAuDVS0fZD98XMlu2gYNwOp0Md8iHw8PD1ljwIioCF85LbNaNKXAXcRAUDYWcc3NzJw4ahKgGQM4uXpDYZyOPM9/2Wbay/CS7euU4B6aAwLScVXgBByC0GgOoUkARuOvMxzQ8wVighKu9OYODq6qqYisrK2xzc/NaWVmZ/iA4oSsuLj6CrSYFw5/mM+ed/DAA0tu38pjFomc2m42Tc2tr68a/ARHe22NjY1EGBIEXKZif94bHql5IBdfoaex5oKKiAqampl4bGhq6PTIyIv2TyqkA4JvbbDYLauc6nQCiqIOZGa/mI5vNAM47BWA2/QJFRUXQ2dl5rrS09OuZmZlc5MjfAsEBIJl0IaeCpsoQCBry+xncu+ePAuEaOw31V9KgoaEB7HZ7Nm7Xodra2qdkew9UOTWTkFh7REDAFsDt3tzTQMdbNmhpehRaW1uhuro6OyUl5ePe3t6rCOKBIsEB9Pf3s8jJoYrLOBC9HmB1NQDLy/49jTQ1ZcCtmyfg228+AiSzyePxvNnT02NHct53m3IAmLeQtwhRoiCgEojp6T/2NUTkdH5SgL1FKC8v5+QcHBzscLlcEvxFOvTqByxEe5w0DNA/iDhzYyMIPb2/QjAIu3AF0ECvfUmCt9+Z5+Ts6Oiow1P1HFbOZzIzM91KkYN9IkFnQbgOUCX86ouTXL/8/CRWxXxWd9mqGOCtWtVjMiRN5cSI5MuVUyOCCgC9TEL/K2gEEAC8clEKxQBNLSz4oPpFN1RWVkJbWxtGIbhrBOeTiqLIVYesVcZoPbi9SX9fXV29hO1N/CS4VwoigrkrHo8PLtf9jFvPBu3t7TA6Ovry+Pj4HDpiOzs7gl4fMoOgGO6CALX0mJCQEKQ5SUlJfoPB4M/Ly/MS33DLan3JJ5vmNFSn4MyZRIbIeemdmJi4ge/TUY8ZjUYpLS3Nin3So8nJydRKCCIV20dQqTWjGlETUI/IkRY0EUCj+26V9z/4DVyuTXA43oP4+HgHFpt3cXgbNbC+vk7KMjIysFzPC7hSYWNjg62tralN8GgoLf3zRhFRJkecmZapisDr19N5v6Wlhf6IvkMHafhsQocJdHjRISQvQlT6kWOksn1x338IJQWg2gXPP2diRqOOH72Y57murq4SAkihlJ1wY6oDKKqvVriPRHGAVDly+/r6njWZTBYcS4RQHmPzT6gGoJDO7XbbiWyy8ziI0Y0pCoDD4WCLi4vdmPdjdF+A0B/Tgf2CaUThgHIvINLhXWACx46jpqDGx8p5OJwFBQXhwcbGxvnu7u7zGBE6fXZQ6RhUuBET4TcjSZKMFIGBgYGns7KywqSL9bVMAUBbK2lhYeE6tiYIVa64w3BOIlCxwDQQy2nVlHOlbB6OKFd02bH+sFYeKZEV7aH8/+VPXTO9DRqcKEgAAAAASUVORK5CYII=";
// tslint:disable-next-line: max-line-length
const CLICK_ICON = "data:image/png;base64,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";
// tslint:disable-next-line: max-line-length
const TOUCH_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAYCAYAAAD6S912AAAACXBIWXMAAAsTAAALEwEAmpwYAAAFEmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDIgNzkuMTYwOTI0LCAyMDE3LzA3LzEzLTAxOjA2OjM5ICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgKFdpbmRvd3MpIiB4bXA6Q3JlYXRlRGF0ZT0iMjAxOS0wOS0xMVQwNjo1MzozMC0wNzowMCIgeG1wOk1vZGlmeURhdGU9IjIwMTktMDktMTFUMDY6NTQ6NDAtMDc6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMTktMDktMTFUMDY6NTQ6NDAtMDc6MDAiIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiBwaG90b3Nob3A6SUNDUHJvZmlsZT0ic1JHQiBJRUM2MTk2Ni0yLjEiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6ODZmNTE5ZGQtN2E3MS1hOTQyLTgwNTktMjc3OTJjNTM1YTNlIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjg2ZjUxOWRkLTdhNzEtYTk0Mi04MDU5LTI3NzkyYzUzNWEzZSIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSJ4bXAuZGlkOjg2ZjUxOWRkLTdhNzEtYTk0Mi04MDU5LTI3NzkyYzUzNWEzZSI+IDx4bXBNTTpIaXN0b3J5PiA8cmRmOlNlcT4gPHJkZjpsaSBzdEV2dDphY3Rpb249ImNyZWF0ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6ODZmNTE5ZGQtN2E3MS1hOTQyLTgwNTktMjc3OTJjNTM1YTNlIiBzdEV2dDp3aGVuPSIyMDE5LTA5LTExVDA2OjUzOjMwLTA3OjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgQ0MgKFdpbmRvd3MpIi8+IDwvcmRmOlNlcT4gPC94bXBNTTpIaXN0b3J5PiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgqF3McAAAOgSURBVDiNlZVdbBRVFMd/d7o7penS7c6ghT60JRLCRx9s0JAIUvajJtCkVYw1IVaKUr/wpQk+qO8YRV8aEw3Q1EjpAwkNlkZNDMEYxUDoh9gSH7CNrXQptbtsHeluu7vHh5kuQ90l8k9ucuece373zJl77igRwa1YXK0BmoFdwFpAc1xZYBb4EegzAnKbPFJuYCyungEOAOuAsnwBwN/ADHDGCEhfQWAsrlqAl4DKAqCVmgV6jICcdhs1B/bUQ8IAHgH2x+IqeB8wFlcm9mvmYOFwq2kavsdNg22msWVzf39VSQFoBfBKLK787gx3A48tG44cCfpHhk/VwKYFn+9QFKL6wTZ9/Z07mvYfnK0aYIcbGARyGXzR/Wg5eOXq4Oj4H5Mnp3fVN0zBjZJjHz3tKwAscpLKATcAxcsGkUQRlGQMYzED0Ng4mgJNLEtXBYC6w8gBVxdY+DAqdwMXH7RSKQBFT090XXVVe+XQULl+7VqZPjWle1zLkssTD/Z5KuVeR+SRR2DWa1ndaxsingpIalCc9ftfu/XW4aH5UOhGIhK+l+Goe4eVsixdmeaB6Fxs5tdIw7MTUJ6urj40BaFEInG88oOjVzc1RJLNSqnmZeC5s2fXZ2u3tlfs3NG2Bma9duK2AoGF7OG3r1gAHR0X75pm0+zQ8MnbX39z5SYEE3V1rddBpoFP7OJAE3jPwFKx/ShA5eL4xK0xvz+bjUa9nlSqiJqaZDqR0LTBwQo9FIomLUtpY2OGtn37XK9p4AfeExGlgN+gqPjEiarzHm+m/mDbwmYQxidio35/NvuA75UFLgCfmgZvAu+LiNKAjZD5bt/zEx83NU32trRsG4GyTDqtKYDOzjpfIqFpS0uorq4tpZkMpFL8FQ63Xr982ew2AnLTvYsGXAL2mQa6EZAPP/v826P1u58cSqfVPLDQ/1VtkWV50um0Sg0M1GZEmIpGV305Mnzql7175v50nZbc5B3ge+C4UqpRRM719akL2P25dXJyVXB+Xv+9tDQ9c+knvWxw0Dy2d8/cXeANp+AA1cA0AM59+Krj7BQR3AN4GTCw2/MF7N4tATocmwcYB86LCO7ALgf64gpgBLs9vdi/BQ27f59z/BuduHdXAlcDPwP/AE+szLTQANod4M77gI6zFpgHhgH//wSexm5fn4jgbnBEZFQp9TrQCwwopfqd85bv6soAAaeuvSJi5T5Knl33O4UWJzDfyDr+H4ANy7H/AvM1z7/FQv/oAAAAAElFTkSuQmCC";

const CLARITY_CANVAS = "clarity-canvas";
const CLARITY_CLICK = "clarity-click";
const CLARITY_POINTER = "clarity-pointer";
const CLARITY_POINTER_CLICK = "clarity-pointer-click";
const CLARITY_POINTER_TOUCH = "clarity-pointer-touch";
const CLARITY_POINTER_MOVE = "clarity-pointer-move";
const CLARITY_CLICK_RING = "clarity-click-ring";
const ROUND = "round";
const PIXEL = "px";

const config = {
    margin: 10,
    pointerWidth: 32,
    pointerHeight: 32,
    pointerOffsetX: 5,
    pointerOffsetY: 1,
    clickWidth: 22,
    clickHeight: 22,
    pixelLife: 3000,
    trailWidth: 6,
    zIndex: 10000000
}

let points: Point[] = [];
let scrollPointIndex = 0;

export function reset(): void {
    points = [];
    scrollPointIndex = 0;
}

export function scroll(event: Interaction.ScrollEvent, iframe: HTMLIFrameElement): void {
    let data = event.data;
    let de = iframe.contentDocument.documentElement;
    let scrollTarget = element(data.target as number) as HTMLElement || iframe.contentDocument.body;
    if (scrollTarget) { scrollTarget.scrollTo(data.x, data.y); }

    // Position canvas relative to scroll events
    let canvas = overlay(iframe);
    if (canvas) {
        canvas.style.left = data.x + PIXEL;
        canvas.style.top = data.y + PIXEL;
        canvas.width = de.clientWidth;
        canvas.height = de.clientHeight;
    }

    scrollPointIndex = points.length;
}

export function resize(
    event: Interaction.ResizeEvent,
    iframe: HTMLIFrameElement,
    onresize?: (width: number, height: number) => void): void {
    let data = event.data;
    let width = data.width;
    let height = data.height;
    if (onresize) { onresize(width, height); } else {
        let margin = config.margin;
        let px = PIXEL;
        let container = iframe.ownerDocument.documentElement;
        let offsetTop = iframe.offsetTop;
        let availableWidth = container.clientWidth - (2 * margin);
        let availableHeight = container.clientHeight - offsetTop - (2 * margin);
        let scale = Math.min(Math.min(availableWidth / width, 1), Math.min(availableHeight / height, 1));
        iframe.removeAttribute("style");
        iframe.style.position = "relative";
        iframe.style.width = width + px;
        iframe.style.height = height + px;
        iframe.style.transformOrigin = "0 0 0";
        iframe.style.transform = "scale(" + scale + ")";
        iframe.style.border = "1px solid #cccccc";
        iframe.style.overflow = "hidden";
        iframe.style.left = ((container.clientWidth - (width * scale)) / 2) + px;
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

export function selection(event: Interaction.SelectionEvent, iframe: HTMLIFrameElement): void {
    let data = event.data;
    let doc = iframe.contentDocument;
    let s = doc.getSelection();
    // Wrapping selection code inside a try / catch to avoid throwing errors when dealing with elements inside the shadow DOM.
    try { s.setBaseAndExtent(element(data.start as number), data.startOffset, element(data.end as number), data.endOffset); } catch (ex) {
        console.warn("Exception encountered while trying to set selection: " + ex);
    }
}

export function pointer(event: Interaction.PointerEvent, iframe: HTMLIFrameElement): void {
    let data = event.data;
    let type = event.event;
    let doc = iframe.contentDocument;
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
            `#${CLARITY_CANVAS} { position: absolute; left: 0; top: 0; z-index: ${config.zIndex} }` +
            `#${CLARITY_POINTER} { position: absolute; z-index: ${config.zIndex + 2}; url(${POINTER_ICON}) no-repeat left center; width: ${pointerWidth}px; height: ${pointerHeight}px; }` +
            `.${CLARITY_CLICK}, .${CLARITY_CLICK_RING} { position: absolute; z-index: ${config.zIndex + 1}; border-radius: 50%; background: radial-gradient(rgba(255,0,0,0.8), transparent); width: ${config.clickWidth}px; height: ${config.clickHeight}px;}` +
            `.${CLARITY_CLICK_RING} { background: transparent; border: 1px solid rgba(255,0,0,0.8); }` + 
            `.${CLARITY_POINTER_CLICK} { background-image: url(${CLICK_ICON}); }` +
            `.${CLARITY_POINTER_TOUCH} { background-image: url(${TOUCH_ICON}); }` +
            `.${CLARITY_POINTER_MOVE} { background-image: url(${POINTER_ICON}); }`;

        p.appendChild(style);
    }

    p.style.left = (data.x - config.pointerOffsetX) + PIXEL;
    p.style.top = (data.y - config.pointerOffsetY) + PIXEL;
    switch (type) {
        case Data.Event.Click:
        case Data.Event.RightClick:
        case Data.Event.DoubleClick:
            drawClick(doc, data.x, data.y);
            p.className = CLARITY_POINTER_CLICK;
            break;
        case Data.Event.TouchMove:
        case Data.Event.TouchStart:
        case Data.Event.TouchEnd:
        case Data.Event.TouchCancel:
            p.className = CLARITY_POINTER_TOUCH;
            break;
        case Data.Event.MouseMove:
            p.style.background = CLARITY_POINTER_MOVE;
            points.push({time: event.time, x: data.x, y: data.y});
            drawTrail(points[points.length-1].time, overlay(iframe));
            break;
        default:
            p.style.background = CLARITY_POINTER_MOVE;
            break;
    }
}

function drawClick(doc: Document, x: number, y: number): void {
    let click = doc.createElement("DIV");
    click.className = CLARITY_CLICK;
    click.style.left = (x - config.clickWidth / 2) + PIXEL;
    click.style.top = (y - config.clickHeight / 2) + PIXEL
    doc.body.appendChild(click);

    // First pulsating ring
    let ringOne = click.cloneNode() as HTMLElement;
    ringOne.className = CLARITY_CLICK_RING;
    ringOne.style.left = "-0.5" + PIXEL;
    ringOne.style.top = "-0.5" + PIXEL;
    ringOne.style.animation = "pulsate-one 1 1s";
    click.appendChild(ringOne);

    // Second pulsating ring
    let ringTwo = ringOne.cloneNode() as HTMLElement;
    ringTwo.style.animation = "pulsate-two 1 1s";
    click.appendChild(ringTwo);
}

function overlay(iframe: HTMLIFrameElement): HTMLCanvasElement {
    // Create canvas for visualizing interactions
    let doc = iframe.contentDocument;
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
    return p;
}

function drawTrail(now: number, canvas: HTMLCanvasElement): void {
    if (canvas) {
        const ctx = canvas.getContext('2d');
        const path = match(now);
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
    let subfactor: number = (Math.round(factor * 100) % 25) / 25.0;
    let r: number = 0;
    let g: number = 0;
    let b: number = 0;
    if(factor > 0.75) {
        r = 255;
        g = Math.round(255 - 255 * subfactor);
        b = 0;
    } else if (factor > 0.5) {
        r = Math.round(255 - 255 * subfactor);
        g = 255;
        b = 0;
    } else if (factor > 0.25) {
        r = 0;
        g = 255;
        b = Math.round(255 - 255 * subfactor);
    } else {
        r = 0;
        g = Math.round(255 - 255 * subfactor);
        b = 255;
    }
    return `rgba(${r}, ${g}, ${b}, ${factor})`;
}
