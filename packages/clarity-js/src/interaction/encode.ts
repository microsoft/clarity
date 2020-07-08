import { Event, Metric, TargetInfo, Token } from "@clarity-types/data";
import * as task from "@src/core/task";
import { time } from "@src/core/time";
import { observe } from "@src/data/target";
import { queue } from "@src/data/upload";
import * as click from "@src/interaction/click";
import * as input from "@src/interaction/input";
import * as pointer from "@src/interaction/pointer";
import * as resize from "@src/interaction/resize";
import * as scroll from "@src/interaction/scroll";
import * as selection from "@src/interaction/selection";
import * as unload from "@src/interaction/unload";
import * as visibility from "@src/interaction/visibility";

export default async function (type: Event): Promise<void> {
    let t = time();
    let tokens: Token[] = [t, type];
    let timer = Metric.InteractionDuration;
    task.start(timer);
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
                if (task.shouldYield(timer)) { await task.suspend(timer); }
                let entry = pointer.state[i];
                tokens = [entry.time, entry.event];
                tokens.push(observe(entry.data.target as TargetInfo));
                tokens.push(entry.data.x);
                tokens.push(entry.data.y);
                queue(tokens);
            }
            pointer.reset();
            break;
        case Event.Click:
            let c = click.data;
            tokens.push(observe(c.target as TargetInfo));
            tokens.push(c.x);
            tokens.push(c.y);
            tokens.push(c.button);
            tokens.push(c.text);
            tokens.push(c.link);
            click.reset();
            queue(tokens);
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
                tokens = [entry.time, entry.event];
                tokens.push(observe(entry.data.target as TargetInfo));
                tokens.push(entry.data.value);
                queue(tokens);
            }
            input.reset();
            break;
        case Event.Selection:
            let s = selection.data;
            if (s) {
                tokens.push(observe(s.start as TargetInfo));
                tokens.push(s.startOffset);
                tokens.push(observe(s.end as TargetInfo));
                tokens.push(s.endOffset);
                selection.reset();
                queue(tokens);
            }
            break;
        case Event.Scroll:
            for (let i = 0; i < scroll.state.length; i++) {
                if (task.shouldYield(timer)) { await task.suspend(timer); }
                let entry = scroll.state[i];
                tokens = [entry.time, entry.event];
                tokens.push(observe(entry.data.target as TargetInfo));
                tokens.push(entry.data.x);
                tokens.push(entry.data.y);
                queue(tokens);
            }
            scroll.reset();
            break;
        case Event.Visibility:
            let v = visibility.data;
            tokens.push(v.visible);
            visibility.reset();
            queue(tokens);
            break;
    }
    task.stop(timer);
}
