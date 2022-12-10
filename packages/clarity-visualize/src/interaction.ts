import { Asset, Constant, PlaybackState, Point, Setting } from "@clarity-types/visualize";
import { Data, Interaction, Layout } from "clarity-decode";
import { LayoutHelper } from "./layout";

export class InteractionHelper {
    static TRAIL_START_COLOR = [242, 97, 12]; // rgb(242,97,12)
    static TRAIL_END_COLOR = [249, 220, 209]; // rgb(249,220,209)

    hoverId: number = null;
    targetId: number = null;
    points: Point[] = [];
    scrollPointIndex = 0;
    clickAudio = null;
    layout: LayoutHelper;
    state: PlaybackState;

    constructor(state: PlaybackState, layout: LayoutHelper) {
        this.state = state;
        this.layout = layout;
    }

    public reset = (): void => {
        this.points = [];
        this.scrollPointIndex = 0;
        this.clickAudio = null;
        this.hoverId = null;
        this.targetId = null;
        this.layout.reset();
    };

    public scroll = (event: Interaction.ScrollEvent): void => {
        let data = event.data;
        let doc = this.state.window.document;
        let de = doc.documentElement;
        let scrollTarget = this.layout.element(data.target as number) as HTMLElement || doc.body;
        let scrollable = scrollTarget.scrollHeight > scrollTarget.clientHeight || scrollTarget.scrollWidth > scrollTarget.clientWidth;
        if (scrollTarget && scrollable) {
            scrollTarget.scrollTo(data.x, data.y);
            // In an edge case, scrolling API doesn't work when css on HTML element has height:100% and overflow:auto
            // In those cases, we fall back to scrolling the body element.
            if (scrollTarget === de && scrollTarget.offsetTop !== data.y) {
                scrollTarget = doc.body;
                scrollTarget.scrollTo(data.x, data.y);
            }
        }

        // Position canvas relative to scroll events on the parent page
        if (scrollTarget === de || scrollTarget === doc.body) {
            if (!scrollable) { this.state.window.scrollTo(data.x, data.y); }
            let canvas = this.overlay();
            if (canvas) {
                canvas.style.left = data.x + Constant.Pixel;
                canvas.style.top = data.y + Constant.Pixel;
                canvas.width = de.clientWidth;
                canvas.height = de.clientHeight;
            }
            this.scrollPointIndex = this.points.length;
        }
    };

    public resize = (event: Interaction.ResizeEvent): void => {
        let data = event.data;
        let width = data.width;
        let height = data.height;
        if (this.state.options.onresize) {
            this.state.options.onresize(width, height);
        }
    };

    public visibility = (event: Interaction.VisibilityEvent): void => {
        let doc = this.state.window.document;
        if (doc && doc.documentElement && event.data.visible !== Constant.Visible) {
            doc.documentElement.style.backgroundColor = Constant.Black;
            doc.documentElement.style.opacity = Constant.HiddenOpacity;
        } else {
            doc.documentElement.style.backgroundColor = Constant.Transparent;
            doc.documentElement.style.opacity = Constant.VisibleOpacity;
        }
    };

    public input = (event: Interaction.InputEvent): void => {
        let data = event.data;
        let el = this.layout.element(data.target as number) as HTMLInputElement;
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
    };

    public selection = (event: Interaction.SelectionEvent): void => {
        let data = event.data;
        let doc = this.state.window.document;
        let s = doc.getSelection();
        // Wrapping selection code inside a try / catch to avoid throwing errors when dealing with elements inside the shadow DOM.
        try { s.setBaseAndExtent(this.layout.element(data.start as number), data.startOffset, this.layout.element(data.end as number), data.endOffset); } catch (ex) {
            console.warn("Exception encountered while trying to set selection: " + ex);
        }
    };

    public pointer = (event: Interaction.PointerEvent): void => {
        let data = event.data;
        let type = event.event;
        let doc = this.state.window.document;
        let de = doc.documentElement;
        let p = doc.getElementById(Constant.PointerLayer);
        let pointerWidth = Setting.PointerWidth;
        let pointerHeight = Setting.PointerHeight;

        if (p === null) {
            p = doc.createElement("DIV");
            p.id = Constant.PointerLayer;
            de.appendChild(p);

            // Add custom styles
            let style = doc.createElement("STYLE");
            style.textContent =
                "@keyframes pulsate-one { 0% { transform: scale(1, 1); opacity: 1; } 100% { transform: scale(3, 3); opacity: 0; } }" +
                "@keyframes pulsate-two { 0% { transform: scale(1, 1); opacity: 1; } 100% { transform: scale(5, 5); opacity: 0; } }" +
                "@keyframes pulsate-touch { 0% { transform: scale(1, 1); opacity: 1; } 100% { transform: scale(2, 2); opacity: 0; } }" +
                "@keyframes disappear { 90% { transform: scale(1, 1); opacity: 1; } 100% { transform: scale(1.3, 1.3); opacity: 0; } }" +
                `#${Constant.InteractionCanvas} { position: absolute; left: 0; top: 0; z-index: ${Setting.ZIndex}; background: none; }` +
                `#${Constant.PointerLayer} { position: absolute; z-index: ${Setting.ZIndex}; url(${Asset.Pointer}) no-repeat left center; width: ${pointerWidth}px; height: ${pointerHeight}px; }` +
                `.${Constant.ClickLayer}, .${Constant.ClickRing}, .${Constant.TouchLayer}, .${Constant.TouchRing} { position: absolute; z-index: ${Setting.ZIndex}; border-radius: 50%; background: radial-gradient(rgba(0,90,158,0.8), transparent); width: ${Setting.ClickRadius}px; height: ${Setting.ClickRadius}px;}` +
                `.${Constant.ClickRing} { background: transparent; border: 1px solid rgba(0,90,158,0.8); }` +
                `.${Constant.TouchLayer} { background: radial-gradient(rgba(242,97,12,1), transparent); }` +
                `.${Constant.TouchRing} { background: transparent; border: 1px solid rgba(242,97,12,0.8); }` +
                `.${Constant.PointerClickLayer} { background-image: url(${Asset.Click}); }` +
                `.${Constant.PointerNone} { background: none; }` +
                `.${Constant.PointerMove} { background-image: url(${Asset.Pointer}); }`;

            p.appendChild(style);
        }

        p.style.left = (data.x - Setting.PointerOffset) + Constant.Pixel;
        p.style.top = (data.y - Setting.PointerOffset) + Constant.Pixel;
        let title = "Pointer"
        switch (type) {
            case Data.Event.Click:
                title = "Click";
                this.drawClick(doc, data.x, data.y, title);
                p.className = Constant.PointerNone;
                break;
            case Data.Event.DoubleClick:
                title = "Click";
                this.drawClick(doc, data.x, data.y, title);
                p.className = Constant.PointerNone;
                break;
            case Data.Event.TouchStart:
            case Data.Event.TouchEnd:
            case Data.Event.TouchCancel:
                title = "Touch";
                this.drawTouch(doc, data.x, data.y, title);
                p.className = Constant.PointerNone;
                break;
            case Data.Event.TouchMove:
                title = "Touch Move";
                p.className = Constant.PointerNone;
                break;
            case Data.Event.MouseMove:
                title = "Mouse Move";
                p.className = Constant.PointerMove;
                this.addPoint({ time: event.time, x: data.x, y: data.y });
                this.targetId = data.target as number;
                break;
            default:
                p.className = Constant.PointerMove;
                break;
        }
        p.setAttribute(Constant.Title, `${title} (${data.x}${Constant.Pixel}, ${data.y}${Constant.Pixel})`);
    };

    private hover = (): void => {
        if (this.targetId && this.targetId !== this.hoverId) {
            let depth = 0;
            // First, remove any previous hover class assignments
            let hoverNode = this.hoverId ? this.layout.element(this.hoverId) as HTMLElement : null;
            while (hoverNode && depth < Setting.HoverDepth) {
                if ("removeAttribute" in hoverNode) { hoverNode.removeAttribute(Constant.HoverAttribute); }
                hoverNode = hoverNode.parentElement;
                depth++;
            }
            // Then, add hover class on elements that are below the pointer
            depth = 0;
            let targetNode = this.targetId ? this.layout.element(this.targetId) as HTMLElement : null;
            while (targetNode && depth < Setting.HoverDepth) {
                if ("setAttribute" in targetNode) { targetNode.setAttribute(Constant.HoverAttribute, Layout.Constant.Empty); }
                targetNode = targetNode.parentElement;
                depth++;
            }
            // Finally, update hoverId to reflect the new node
            this.hoverId = this.targetId;
        }
    };

    private addPoint = (point: Point): void => {
        let last = this.points.length > 0 ? this.points[this.points.length - 1] : null;
        if (last && point.x === last.x && point.y === last.y) {
            last.time = point.time;
        } else { this.points.push(point); }
    }

    private drawTouch = (doc: Document, x: number, y: number, title: string): void => {
        let de = doc.documentElement;
        let touch = doc.createElement("DIV");
        touch.className = Constant.TouchLayer;
        touch.setAttribute(Constant.Title, `${title} (${x}${Constant.Pixel}, ${y}${Constant.Pixel})`);
        touch.style.left = (x - Setting.ClickRadius / 2) + Constant.Pixel;
        touch.style.top = (y - Setting.ClickRadius / 2) + Constant.Pixel
        touch.style.animation = "disappear 1 1s";
        touch.style.animationFillMode = "forwards";
        de.appendChild(touch);

        // First pulsating ring
        let ringOne = touch.cloneNode() as HTMLElement;
        ringOne.className = Constant.TouchRing;
        ringOne.style.left = "-0.5" + Constant.Pixel;
        ringOne.style.top = "-0.5" + Constant.Pixel;
        ringOne.style.animation = "pulsate-touch 1 1s";
        ringOne.style.animationFillMode = "forwards";
        touch.appendChild(ringOne);
    };

    private drawClick = (doc: Document, x: number, y: number, title: string): void => {
        let de = doc.documentElement;
        let click = doc.createElement("DIV");
        click.className = Constant.ClickLayer;
        click.setAttribute(Constant.Title, `${title} (${x}${Constant.Pixel}, ${y}${Constant.Pixel})`);
        click.style.left = (x - Setting.ClickRadius / 2) + Constant.Pixel;
        click.style.top = (y - Setting.ClickRadius / 2) + Constant.Pixel
        de.appendChild(click);

        // First pulsating ring
        let ringOne = click.cloneNode() as HTMLElement;
        ringOne.className = Constant.ClickRing;
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
        if (typeof Audio !== Constant.Undefined) {
            if (this.clickAudio === null) { 
                this.clickAudio = new Audio(Asset.Sound); 
                click.appendChild(this.clickAudio);
            }
            this.clickAudio.play();
        }
    };

    private overlay = (): HTMLCanvasElement => {
        // Create canvas for visualizing interactions
        let doc = this.state.window.document;
        let de = doc.documentElement;
        let canvas = doc.getElementById(Constant.InteractionCanvas) as HTMLCanvasElement;
        if (canvas === null) {
            canvas = doc.createElement("canvas");
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
    };

    private match = (time: number): Point[] => {
        let p = [];
        for (let i = this.points.length - 1; i > 0; i--) {
            // Each pixel in the trail has a pixel life of 3s. The only exception to this is if the user scrolled.
            // We reset the trail after every scroll event to avoid drawing weird looking trail.
            if (i >= this.scrollPointIndex && time - this.points[i].time < Setting.PixelLife) {
                p.push(this.points[i]);
            } else { break; }
        }
        return p.slice(0, Setting.MaxTrailPoints);
    };

    public trail = (now: number): void => {
        const canvas = this.overlay();
        if (this.state.options.canvas && canvas) {
            const ctx = canvas.getContext('2d');
            const path = this.state.options.keyframes ? this.curve(this.points.reverse()) : this.curve(this.match(now));
            // Update hovered elements
            this.hover();
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
                    let lastFactor = 1 - ((i - 1) / count);
                    let currentFactor = 1 - (i / count);

                    // Generate a color gradient that goes from red -> yellow -> green -> light blue -> blue
                    let gradient = ctx.createLinearGradient(last.x, last.y, current.x, current.y);
                    gradient.addColorStop(1, this.color(currentFactor))
                    gradient.addColorStop(0, this.color(lastFactor))

                    // Line width of the trail shrinks as the position of the point goes farther away.
                    ctx.lineWidth = Setting.TrailWidth * currentFactor;
                    ctx.lineCap = Constant.Round;
                    ctx.lineJoin = Constant.Round;
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
            // If we are only rendering key frames, clear points array after each key frame
            if (this.state.options.keyframes) { this.points = []; }
        }
    };

    private color = (factor: number): string => {
        let s = InteractionHelper.TRAIL_START_COLOR;
        let e = InteractionHelper.TRAIL_END_COLOR;
        let c = [];
        for (let i = 0; i < 3; i++) { c[i] = Math.round(e[i] + factor * (s[i] - e[i])); }
        return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${factor})`;
    };

    // Reference: https://en.wikipedia.org/wiki/Cubic_Hermite_spline#Cardinal_spline
    private curve = (path: Point[]): Point[] => {
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
        for (let i = 1; i < p.length - 2; i++) {
            const time = p[i].time;
            const segments = Math.max(Math.min(Math.round(this.distance(p[i], p[i - 1])), 10), 1);
            for (let t = 0; t <= segments; t++) {

                // Compute tension vectors
                let t1: Point = { time, x: (p[i + 1].x - p[i - 1].x) * tension, y: (p[i + 1].y - p[i - 1].y) * tension };
                let t2: Point = { time, x: (p[i + 2].x - p[i].x) * tension, y: (p[i + 2].y - p[i].y) * tension };
                let step = t / segments;

                // Compute cardinals
                let c1 = 2 * Math.pow(step, 3) - 3 * Math.pow(step, 2) + 1;
                let c2 = -(2 * Math.pow(step, 3)) + 3 * Math.pow(step, 2);
                let c3 = Math.pow(step, 3) - 2 * Math.pow(step, 2) + step;
                let c4 = Math.pow(step, 3) - Math.pow(step, 2);

                // Compute new point with common control vectors
                let x = c1 * p[i].x + c2 * p[i + 1].x + c3 * t1.x + c4 * t2.x;
                let y = c1 * p[i].y + c2 * p[i + 1].y + c3 * t1.y + c4 * t2.y;

                output.push({ time, x, y });
            }
        }
        return output;
    };

    private distance = (a: Point, b: Point): number => {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    };
}
