import { Event, Token } from "@clarity-types/data";
import { time } from "@src/core/time";
import { queue } from "@src/data/upload";
import { metadata } from "@src/layout/target";
import * as baseline from "./baseline";
import * as click from "./click";
import * as input from "./input";
import * as pointer from "./pointer";
import * as resize from "./resize";
import * as scroll from "./scroll";
import * as selection from "./selection";
import * as unload from "./unload";
import * as visibility from "./visibility";

export default async function (type: Event): Promise<void> {
    let t = time();
    let tokens: Token[] = [t, type];
    switch (type) {
        case Event.MouseDown:
        case Event.MouseUp:
        case Event.MouseMove:
        case Event.MouseWheel:
        case Event.DoubleClick:
        case Event.TouchStart:
        case Event.TouchEnd:
        case Event.TouchMove:
        case Event.TouchCancel:
            for (let i = 0; i < pointer.state.length; i++) {
                let entry = pointer.state[i];
                let pTarget = metadata(entry.data.target as Node);
                tokens = [entry.time, entry.event];
                tokens.push(pTarget.id);
                tokens.push(entry.data.x);
                tokens.push(entry.data.y);
                queue(tokens);
                baseline.track(entry.event, entry.data.x, entry.data.y); // Track changes to baseline
            }
            pointer.reset();
            break;
        case Event.Click:
            for (let i = 0; i < click.state.length; i++) {
                let entry = click.state[i];
                let cTarget = metadata(entry.data.target as Node, true);
                tokens = [entry.time, entry.event];
                tokens.push(cTarget.id);
                tokens.push(entry.data.x);
                tokens.push(entry.data.y);
                tokens.push(entry.data.eX);
                tokens.push(entry.data.eY);
                tokens.push(entry.data.button);
                tokens.push(entry.data.text);
                tokens.push(entry.data.link);
                tokens.push(cTarget.hash);
                if (cTarget.region) { tokens.push(cTarget.region); }
                queue(tokens);
                baseline.track(entry.event, entry.data.x, entry.data.y); // Track changes to baseline
            }
            click.reset();
            break;
        case Event.Resize:
            let r = resize.data;
            tokens.push(r.width);
            tokens.push(r.height);
            resize.reset();
            queue(tokens);
            break;
        case Event.Unload:
            let u = unload.data;
            tokens.push(u.name);
            unload.reset();
            queue(tokens);
            break;
        case Event.Input:
            for (let i = 0; i < input.state.length; i++) {
                let entry = input.state[i];
                let iTarget = metadata(entry.data.target as Node, true);
                tokens = [entry.time, entry.event];
                tokens.push(iTarget.id);
                tokens.push(entry.data.value);
                if (iTarget.region) { tokens.push(iTarget.region); }
                queue(tokens);
            }
            input.reset();
            break;
        case Event.Selection:
            let s = selection.data;
            if (s) {
                let startTarget = metadata(s.start as Node, true);
                let endTarget = metadata(s.end as Node);
                tokens.push(startTarget.id);
                tokens.push(s.startOffset);
                tokens.push(endTarget.id);
                tokens.push(s.endOffset);
                if (startTarget.region) { tokens.push(startTarget.region); }
                selection.reset();
                queue(tokens);
            }
            break;
        case Event.Scroll:
            for (let i = 0; i < scroll.state.length; i++) {
                let entry = scroll.state[i];
                let sTarget = metadata(entry.data.target as Node);
                tokens = [entry.time, entry.event];
                tokens.push(sTarget.id);
                tokens.push(entry.data.x);
                tokens.push(entry.data.y);
                queue(tokens);
                baseline.track(entry.event, entry.data.x, entry.data.y); // Track changes to baseline
            }
            scroll.reset();
            break;
        case Event.Visibility:
            let v = visibility.data;
            tokens.push(v.visible);
            queue(tokens);
            baseline.visibility(v.visible);
            visibility.reset();
            break;
        case Event.Baseline:
            let b = baseline.state;
            if (b) {
                tokens = [b.time, b.event];
                tokens.push(b.data.docWidth);
                tokens.push(b.data.docHeight);
                tokens.push(b.data.scrollX);
                tokens.push(b.data.scrollY);
                tokens.push(b.data.pointerX);
                tokens.push(b.data.pointerY);
                queue(tokens);
            }
            baseline.reset();
            break;
    }
}
