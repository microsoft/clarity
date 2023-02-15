import { Activity, Constant, Heatmap, Setting, ScrollMapInfo, PlaybackState } from "@clarity-types/visualize";
import { Data } from "clarity-js";
import { LayoutHelper } from "./layout";

export class HeatmapHelper {
    static COLORS = ["blue", "cyan", "lime", "yellow", "red"];
    data: Activity = null;
    scrollData: ScrollMapInfo[] = null;
    max: number = null;
    offscreenRing: HTMLCanvasElement = null;
    gradientPixels: ImageData = null;
    timeout = null;
    observer: ResizeObserver = null;
    state: PlaybackState = null;
    layout: LayoutHelper = null;
    scrollAvgFold: number = null;
    addScrollMakers: boolean = false;

    constructor(state: PlaybackState, layout: LayoutHelper) {
        this.state = state;
        this.layout = layout;
    }
    
    public reset = (): void => {
        this.data = null;
        this.scrollData = null;
        this.max = null;
        this.offscreenRing = null;
        this.gradientPixels = null;
        this.timeout = null;

        // Reset resize observer
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        // Remove scroll and resize event listeners
        if (this.state && this.state.window) {
            let win = this.state.window;
            win.removeEventListener("scroll", this.redraw, true);
            win.removeEventListener("resize", this.redraw, true);
        }
    }

    public clear = () : void => {
        let doc = this.state.window.document;
        let win = this.state.window;
        let canvas = doc.getElementById(Constant.HeatmapCanvas) as HTMLCanvasElement;
        let de = doc.documentElement;
        if (canvas) {
            canvas.width = de.clientWidth;
            canvas.height = de.clientHeight;
            canvas.style.left = win.pageXOffset + Constant.Pixel;
            canvas.style.top = win.pageYOffset + Constant.Pixel;
            canvas.getContext(Constant.Context).clearRect(0, 0, canvas.width, canvas.height);
        }
        this.reset();
    }

    public scroll = (activity: ScrollMapInfo[], avgFold: number, addMarkers: boolean): void => {
        this.scrollData = this.scrollData || activity;
        this.scrollAvgFold = avgFold != null ? avgFold : this.scrollAvgFold;
        this.addScrollMakers = addMarkers != null ? addMarkers : this.addScrollMakers;

        let canvas = this.overlay();
        let context = canvas.getContext(Constant.Context);
        let doc = this.state.window.document;
        var body = doc.body;
        var de = doc.documentElement;
        var height = Math.max( body.scrollHeight, body.offsetHeight, 
            de.clientHeight, de.scrollHeight, de.offsetHeight );
        canvas.height = Math.min(height, Setting.ScrollCanvasMaxHeight);
        canvas.style.top = 0 + Constant.Pixel;
        if (canvas.width > 0 && canvas.height > 0) {
            if (this.scrollData) {
                const grd = context.createLinearGradient(0, 0, 0, canvas.height);
                for (const currentCombination of this.scrollData) {
                    const huePercentView = 1 - (currentCombination.cumulativeSum / this.scrollData[0].cumulativeSum);
                    const percentView = (currentCombination.scrollReachY / 100) * (height / canvas.height);
                    const hue = huePercentView * Setting.MaxHue;
                    if (percentView <= 1) {
                        grd.addColorStop(percentView, `hsla(${hue}, 100%, 50%, 0.6)`);
                    }
                }

                // Fill with gradient
                context.fillStyle = grd;
                context.fillRect(0, 0, canvas.width, canvas.height);
                if (this.addScrollMakers) {
                    this.addInfoMarkers(context, this.scrollData, canvas.width, canvas.height, this.scrollAvgFold);
                }
            }
        };
    }

    private addInfoMarkers = (context: CanvasRenderingContext2D, scrollMapInfo: ScrollMapInfo[], width: number, height: number, avgFold: number): void => {
        this.addMarker(context, width, Constant.AverageFold, avgFold, Setting.MarkerMediumWidth);
        const markers = [75, 50, 25];
        for (const marker of markers) {
            const closest = scrollMapInfo.reduce((prev: ScrollMapInfo, curr: ScrollMapInfo): ScrollMapInfo => {
                return ((Math.abs(curr.percUsers - marker)) < (Math.abs(prev.percUsers - marker)) ? curr : prev);
            });
            if (closest.percUsers >= marker - Setting.MarkerRange && closest.percUsers <= marker + Setting.MarkerRange) {
                const markerLine = (closest.scrollReachY / 100) * height;
                this.addMarker(context, width, `${marker}%`, markerLine, Setting.MarkerSmallWidth);
            }
        }
    }

    private addMarker = (context: CanvasRenderingContext2D, heatmapWidth: number, label: string, markerY: number, markerWidth: number): void => {
        context.beginPath();
        context.moveTo(0, markerY);
        context.lineTo(heatmapWidth, markerY);
        context.setLineDash([2, 2]);
        context.lineWidth = Setting.MarkerLineHeight;
        context.strokeStyle = Setting.MarkerColor;
        context.stroke();
        context.fillStyle = Setting.CanvasTextColor;
        context.fillRect(0, (markerY - Setting.MarkerHeight / 2), markerWidth, Setting.MarkerHeight);
        context.fillStyle = Setting.MarkerColor;
        context.font = Setting.CanvasTextFont;
        context.fillText(label, Setting.MarkerPadding, markerY + Setting.MarkerPadding);
    }

    public click = (activity: Activity): void => {
        this.data = this.data || activity;
        let heat = this.transform();
        let canvas = this.overlay();
        let ctx = canvas.getContext(Constant.Context);

        if (canvas.width > 0 && canvas.height > 0) {
            // To speed up canvas rendering, we draw ring & gradient on an offscreen canvas, so we can use drawImage API
            // Canvas performance tips: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
            // Pre-render similar primitives or repeating objects on an offscreen canvas
            let ring = this.getRing();
            let gradient = this.getGradient();

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

    private overlay = (): HTMLCanvasElement => {
        // Create canvas for visualizing heatmap
        let doc = this.state.window.document;
        let win = this.state.window;
        let de = doc.documentElement;
        let canvas = doc.getElementById(Constant.HeatmapCanvas) as HTMLCanvasElement;
        if (canvas === null) {
            canvas = doc.createElement(Constant.Canvas) as HTMLCanvasElement;
            canvas.id = Constant.HeatmapCanvas;
            canvas.width = 0;
            canvas.height = 0;
            canvas.style.position = Constant.Absolute;
            canvas.style.zIndex = `${Setting.ZIndex}`;
            de.appendChild(canvas);
            win.addEventListener("scroll", this.redraw, true);
            win.addEventListener("resize", this.redraw, true);
            this.observer = this.state.window["ResizeObserver"] ? new ResizeObserver(this.redraw) : null;
            
            if (this.observer) { this.observer.observe(doc.body); }
        }

        // Ensure canvas is positioned correctly
        canvas.width = de.clientWidth;
        canvas.height = de.clientHeight;
        canvas.style.left = win.pageXOffset + Constant.Pixel;
        canvas.style.top = win.pageYOffset + Constant.Pixel;
        canvas.getContext(Constant.Context).clearRect(0, 0, canvas.width, canvas.height);

        return canvas;
    }

    private getRing = (): HTMLCanvasElement => {
        if (this.offscreenRing === null) {
            let doc = this.state.window.document;
            this.offscreenRing = doc.createElement(Constant.Canvas) as HTMLCanvasElement;
            this.offscreenRing.width = Setting.Radius * 2;
            this.offscreenRing.height = Setting.Radius * 2;
            let ctx = this.offscreenRing.getContext(Constant.Context);
            ctx.shadowOffsetX = Setting.Radius * 2;
            ctx.shadowBlur = Setting.Radius / 2;
            ctx.shadowColor = Constant.Black;
            ctx.beginPath();
            ctx.arc(-Setting.Radius, Setting.Radius, Setting.Radius / 2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.fill();
        }
        return this.offscreenRing;
    }

    private getGradient = (): ImageData => {
        if (this.gradientPixels === null) {
            let doc = this.state.window.document;
            let offscreenGradient = doc.createElement(Constant.Canvas) as HTMLCanvasElement;
            offscreenGradient.width = 1;
            offscreenGradient.height = Setting.Colors;
            let ctx = offscreenGradient.getContext(Constant.Context);
            let gradient = ctx.createLinearGradient(0, 0, 0, Setting.Colors);
            let step = 1 / HeatmapHelper.COLORS.length;
            for (let i = 0; i < HeatmapHelper.COLORS.length; i++) {
                gradient.addColorStop(step * (i + 1), HeatmapHelper.COLORS[i]);
            }
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 1, Setting.Colors);
            this.gradientPixels = ctx.getImageData(0, 0, 1, Setting.Colors);
        }
        return this.gradientPixels;
    }

    private redraw = (event): void => {
        if (this.data) {
            if (this.timeout) { clearTimeout(this.timeout); }
            this.timeout = setTimeout(this.click, Setting.Interval);
        }
        else if (this.scrollData) {
            if (event.type != 'scroll') {
                if (this.timeout) { clearTimeout(this.timeout); }
                this.timeout = setTimeout(this.scroll, Setting.Interval);
            }
        }
    }

    private transform = (): Heatmap[] => {
        let output: Heatmap[] = [];
        let points: { [key: string]: number } = {};
        let localMax = 0;
        let height = this.state.window && this.state.window.document ? this.state.window.document.documentElement.clientHeight : 0;
        for (let element of this.data) {
            let el = this.layout.get(element.hash) as HTMLElement;
            if (el && typeof el.getBoundingClientRect === "function") {
                let r = el.getBoundingClientRect();
                let v = this.visible(el, r, height);
                // Process clicks for only visible elements
                if (this.max === null || v) {
                    for(let i = 0; i < element.points; i++) {
                        let x = Math.round(r.left + (element.x[i] / Data.Setting.ClickPrecision) * r.width);
                        let y = Math.round(r.top + (element.y[i] / Data.Setting.ClickPrecision) * r.height);
                        let k = `${x}${Constant.Separator}${y}${Constant.Separator}${v ? 1 : 0}`;
                        points[k] = k in points ? points[k] + element.clicks[i] : element.clicks[i];
                        localMax = Math.max(points[k], localMax);
                    }
                }
            }
        }

        // Set the max value from the firs t
        this.max = this.max ? this.max : localMax;

        // Once all points are accounted for, convert everything into absolute (x, y)
        for (let coordinates of Object.keys(points)) {
            let parts = coordinates.split(Constant.Separator);
            let alpha = Math.min((points[coordinates] / this.max) + Setting.AlphaBoost, 1);
            if (parts[2] === "1") { output.push({ x: parseInt(parts[0], 10), y: parseInt(parts[1], 10), a: alpha }); }
        }

        return output;
    }

    private visible = (el: HTMLElement, r: DOMRect, height: number): boolean => {
        let doc: Document | ShadowRoot = this.state.window.document;
        let visibility = r.height > height ? true : false;
        if (visibility === false && r.width > 0 && r.height > 0) {
            while (!visibility && doc)
            {
                let shadowElement = null;
                let elements = doc.elementsFromPoint(r.left + (r.width / 2), r.top + (r.height / 2));
                for (let e of elements) {
                    // Ignore if top element ends up being the canvas element we added for heatmap visualization
                    if (e.tagName === Constant.Canvas || (e.id && e.id.indexOf(Constant.ClarityPrefix) === 0)) { continue; }
                    visibility = e === el;
                    shadowElement = e.shadowRoot && e.shadowRoot != doc ? e.shadowRoot : null;
                    break;
                }
                doc = shadowElement;
            }
        }
        return visibility && r.bottom >= 0 && r.top <= height;
    }
}
