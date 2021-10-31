import { Constant, Event, Token } from "@clarity-types/data";
import scrub from "@src/core/scrub";
import { time } from "@src/core/time";
import * as baseline from "@src/data/baseline";
import { queue } from "@src/data/upload";
import { metadata } from "@src/layout/target";
import * as click from "./click";
import * as clipboard from "./clipboard";
import * as input from "./input";
import * as pointer from "./pointer";
import * as resize from "./resize";
import * as scroll from "./scroll";
import * as selection from "./selection";
import * as submit from "./submit";
import * as timeline from "./timeline";
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
            for (let entry of pointer.state) {
                let pTarget = metadata(entry.data.target as Node, entry.event);
                if (pTarget.id > 0) {
                    tokens = [entry.time, entry.event];
                    tokens.push(pTarget.id);
                    tokens.push(entry.data.x);
                    tokens.push(entry.data.y);
                    queue(tokens);
                    baseline.track(entry.event, entry.data.x, entry.data.y);
                }
            }
            pointer.reset();
            break;
        case Event.Click:
            for (let entry of click.state) {
                let cTarget = metadata(entry.data.target as Node, entry.event);
                tokens = [entry.time, entry.event];
                let cHash = cTarget.hash.join(Constant.Dot);
                tokens.push(cTarget.id);
                tokens.push(entry.data.x);
                tokens.push(entry.data.y);
                tokens.push(entry.data.eX);
                tokens.push(entry.data.eY);
                tokens.push(entry.data.button);
                tokens.push(entry.data.reaction);
                tokens.push(entry.data.context);
                tokens.push(scrub(entry.data.text, "click", cTarget.privacy));
                tokens.push(entry.data.link);
                tokens.push(cHash);
                queue(tokens);
                timeline.track(entry.time, entry.event, cHash, entry.data.x, entry.data.y, entry.data.reaction, entry.data.context);
            }
            click.reset();
            break;
        case Event.Clipboard:
            for (let entry of clipboard.state) {
                tokens = [entry.time, entry.event];
                let target = metadata(entry.data.target as Node, entry.event);
                if (target.id > 0) {
                    tokens.push(target.id);
                    tokens.push(entry.data.action);
                    queue(tokens);
                }
            }
            clipboard.reset();
            break;
        case Event.Resize:
            let r = resize.data;
            tokens.push(r.width);
            tokens.push(r.height);
            baseline.track(type, r.width, r.height);
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
            for (let entry of input.state) {
                let iTarget = metadata(entry.data.target as Node, entry.event);
                tokens = [entry.time, entry.event];
                tokens.push(iTarget.id);
                tokens.push(entry.data.value);
                queue(tokens);
            }
            input.reset();
            break;
        case Event.Selection:
            let s = selection.data;
            if (s) {
                let startTarget = metadata(s.start as Node, type);
                let endTarget = metadata(s.end as Node, type);
                tokens.push(startTarget.id);
                tokens.push(s.startOffset);
                tokens.push(endTarget.id);
                tokens.push(s.endOffset);
                selection.reset();
                queue(tokens);
            }
            break;
        case Event.Scroll:
            for (let entry of scroll.state) {
                let sTarget = metadata(entry.data.target as Node, entry.event);
                if (sTarget.id > 0) {
                    tokens = [entry.time, entry.event];
                    tokens.push(sTarget.id);
                    tokens.push(entry.data.x);
                    tokens.push(entry.data.y);
                    queue(tokens);
                    baseline.track(entry.event, entry.data.x, entry.data.y);
                }
            }
            scroll.reset();
            break;
        case Event.Submit:
            for (let entry of submit.state) {
                tokens = [entry.time, entry.event];
                let target = metadata(entry.data.target as Node, entry.event);
                if (target.id > 0) {
                    tokens.push(target.id);
                    queue(tokens);
                }
            }
            submit.reset();
            break;
        case Event.Timeline:
            for (let entry of timeline.updates) {
                tokens = [entry.time, entry.event];
                tokens.push(entry.data.type);
                tokens.push(entry.data.hash);
                tokens.push(entry.data.x);
                tokens.push(entry.data.y);
                tokens.push(entry.data.reaction);
                tokens.push(entry.data.context);
                queue(tokens, false);
            }
            timeline.reset();
            break;
        case Event.Visibility:
            let v = visibility.data;
            tokens.push(v.visible);
            queue(tokens);
            baseline.visibility(t, v.visible);
            visibility.reset();
            break;
    }
}
