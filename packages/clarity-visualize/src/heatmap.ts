import { Activity, Constant, Heatmap, Setting } from "@clarity-types/visualize";
import { Data } from "clarity-decode";
import { state } from "./clarity";
import * as layout from "./layout";

const COLORS = ["blue", "cyan", "lime", "yellow", "red"];

let data: Activity = null;
let max: number = null;
let offscreenRing: HTMLCanvasElement = null;
let gradientPixels: ImageData = null;
let timeout = null;
let observer: ResizeObserver = null;

export function reset(): void {
    data = null;
    max = null;
    offscreenRing = null;
    gradientPixels = null;
    timeout = null;

    // Reset resize observer
    if (observer) {
        observer.disconnect();
        observer = null;
    }

    // Remove scroll and resize event listeners
    if (state && state.player && state.player.contentWindow) {
        let win = state.player.contentWindow;
        win.removeEventListener("scroll", redraw, true);
        win.removeEventListener("resize", redraw, true);
    }
}

export function click(activity: Activity): void {
    data = data || activity;
    let heat = transform();
    let canvas = overlay();
    let ctx = canvas.getContext(Constant.Context);

    if (canvas.width > 0 && canvas.height > 0) {
        // To speed up canvas rendering, we draw ring & gradient on an offscreen canvas, so we can use drawImage API
        // Canvas performance tips: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
        // Pre-render similar primitives or repeating objects on an offscreen canvas
        let ring = getRing();
        let gradient = getGradient();

        // Render activity for each (x,y) coordinate in our data
        for (let entry of heat) {
            ctx.globalAlpha = entry.a;
            ctx.drawImage(ring, entry.x - Setting.Radius, entry.y - Setting.Radius);
        }

        // Add color to the canvas based on alpha value of each pixel
        let pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < pixels.data.length; i += 4) {
            // For each pixel, we have 4 entries in data array: (r,g,b,a)
            // To pick the right color from gradient pixels, we look at the alpha value of the pixel
            // Alpha value ranges from 0-255
            let alpha = pixels.data[i+3];
            if (alpha > 0) {
                let offset = (alpha - 1) * 4;
                pixels.data[i] = gradient.data[offset];
                pixels.data[i + 1] = gradient.data[offset + 1];
                pixels.data[i + 2] = gradient.data[offset + 2];
            }
        }
        ctx.putImageData(pixels, 0, 0);
    };
}

function overlay(): HTMLCanvasElement {
    // Create canvas for visualizing heatmap
    let doc = state.player.contentDocument;
    let win = state.player.contentWindow;
    let de = doc.documentElement;
    let canvas = doc.getElementById(Constant.HeatmapCanvas) as HTMLCanvasElement;
    if (canvas === null) {
        canvas = document.createElement(Constant.Canvas) as HTMLCanvasElement;
        canvas.id = Constant.HeatmapCanvas;
        canvas.width = 0;
        canvas.height = 0;
        canvas.style.position = Constant.Absolute;
        canvas.style.zIndex = `${Setting.ZIndex}`;
        doc.body.appendChild(canvas);
        win.addEventListener("scroll", redraw, true);
        win.addEventListener("resize", redraw, true);
        observer = window["ResizeObserver"] ? new ResizeObserver(redraw) : null;
        if (observer) { observer.observe(doc.body); }
    }

    // Ensure canvas is positioned correctly
    canvas.width = de.clientWidth;
    canvas.height = de.clientHeight;
    canvas.style.left = win.pageXOffset + Constant.Pixel;
    canvas.style.top = win.pageYOffset + Constant.Pixel;
    canvas.getContext(Constant.Context).clearRect(0, 0, canvas.width, canvas.height);

    return canvas;
}

function getRing(): HTMLCanvasElement {
    if (offscreenRing === null) {
        let doc = state.player.contentDocument;
        offscreenRing = doc.createElement(Constant.Canvas) as HTMLCanvasElement;
        offscreenRing.width = Setting.Radius * 2;
        offscreenRing.height = Setting.Radius * 2;
        let ctx = offscreenRing.getContext(Constant.Context);
        ctx.shadowOffsetX = Setting.Radius * 2;
        ctx.shadowBlur = Setting.Radius / 2;
        ctx.shadowColor = Constant.Black;
        ctx.beginPath();
        ctx.arc(-Setting.Radius, Setting.Radius, Setting.Radius / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fill();
    }
    return offscreenRing;
}

function getGradient(): ImageData {
    if (gradientPixels === null) {
        let doc = state.player.contentDocument;
        let offscreenGradient = doc.createElement(Constant.Canvas) as HTMLCanvasElement;
        offscreenGradient.width = 1;
        offscreenGradient.height = Setting.Colors;
        let ctx = offscreenGradient.getContext(Constant.Context);
        let gradient = ctx.createLinearGradient(0, 0, 0, Setting.Colors);
        let step = 1 / COLORS.length;
        for (let i = 0; i < COLORS.length; i++) {
            gradient.addColorStop(step * (i + 1), COLORS[i]);
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1, Setting.Colors);
        gradientPixels = ctx.getImageData(0, 0, 1, Setting.Colors);
    }
    return gradientPixels;
}

function redraw(): void {
    if (data) {
        if (timeout) { clearTimeout(timeout); }
        timeout = setTimeout(click, Setting.Interval);
    }
}

function transform(): Heatmap[] {
    let output: Heatmap[] = [];
    let points: { [key: string]: number } = {};
    let localMax = 0;
    let height = state.player.contentDocument.documentElement.clientHeight;
    for (let hash of Object.keys(data)) {
        let el = layout.get(hash) as HTMLElement;
        if (el && typeof el.getBoundingClientRect === "function") {
            let r = el.getBoundingClientRect();
            let v = visible(el, r, height);
            // Process clicks for only visible elements
            if (max === null || v) {
                for (let c of data[hash].clicks) {
                    let x = Math.round(r.left + (c[0] / Data.Setting.ClickPrecision) * r.width);
                    let y = Math.round(r.top + (c[1] / Data.Setting.ClickPrecision) * r.height);
                    let k = `${x}${Constant.Separator}${y}${Constant.Separator}${v ? 1 : 0}`;
                    points[k] = k in points ? points[k] + c[2] : c[2];
                    localMax = Math.max(points[k], localMax);
                }
            }
        }
    }

    // Set the max value from the firs t
    max = max ? max : localMax;

    // Once all points are accounted for, convert everything into absolute (x, y)
    for (let coordinates of Object.keys(points)) {
        let parts = coordinates.split(Constant.Separator);
        let alpha = Math.min((points[coordinates] / max) + Setting.AlphaBoost, 1);
        if (parts[2] === "1") { output.push({ x: parseInt(parts[0], 10), y: parseInt(parts[1], 10), a: alpha }); }
    }

    return output;
}

function visible(el: HTMLElement, r: DOMRect, height: number): boolean {
    let doc = state.player.contentDocument;
    let visibility = r.height > height ? true : false;
    if (visibility === false && r.width > 0 && r.height > 0) {
        let elements = doc.elementsFromPoint(r.left + (r.width / 2), r.top + (r.height / 2));
        for (let e of elements) {
            // Ignore if top element ends up being the canvas element we added for heatmap visualization
            if (e.tagName === Constant.Canvas || (e.id && e.id.indexOf(Constant.ClarityPrefix) === 0)) { continue; }
            visibility = e === el;
            break;
        }
    }
    return visibility && r.bottom >= 0 && r.top <= height;
}
