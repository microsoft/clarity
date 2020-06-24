import { Event, Token } from "@clarity-types/data";
import { time } from "@src/core/time";
import { queue } from "@src/data/upload";
import * as image from "@src/diagnostic/image";
import * as log from "@src/diagnostic/log";
import * as script from "@src/diagnostic/script";
import { metadata } from "@src/layout/target";

export default async function (type: Event): Promise<void> {
    let tokens: Token[] = [time(), type];

    switch (type) {
        case Event.ScriptError:
            tokens.push(script.data.message);
            tokens.push(script.data.line);
            tokens.push(script.data.column);
            tokens.push(script.data.stack);
            tokens.push(script.data.source);
            queue(tokens);
            break;
        case Event.ImageError:
            if (image.data) {
                let imageTarget = metadata(image.data.target as Node);
                tokens.push(image.data.source);
                tokens.push(imageTarget.id);
                queue(tokens);
            }
            break;
        case Event.Log:
            if (log.data) {
                tokens.push(log.data.code);
                tokens.push(log.data.name);
                tokens.push(log.data.message);
                tokens.push(log.data.stack);
                tokens.push(log.data.severity);
                queue(tokens, false);
            }
            break;
    }
}
