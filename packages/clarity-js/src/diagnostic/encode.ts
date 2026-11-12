import { Event, Token } from "@clarity-types/data";
import * as scrub from "@src/core/scrub";
import { time } from "@src/core/time";
import { queue } from "@src/data/upload";
import * as fraud from "@src/diagnostic/fraud";
import * as internal from "@src/diagnostic/internal";
import * as script from "@src/diagnostic/script";

export default async function (type: Event): Promise<void> {
    let tokens: Token[] = [time(), type];

    switch (type) {
        case Event.ScriptError:
            tokens.push(script.data.message, script.data.line, script.data.column, script.data.stack, scrub.url(script.data.source));
            queue(tokens);
            break;
        case Event.Log:
            if (internal.data) {
                tokens.push(internal.data.code, internal.data.name, internal.data.message, internal.data.stack, internal.data.severity);
                queue(tokens, false);
            }
            break;
        case Event.Fraud:
            if (fraud.data) {
                tokens.push(fraud.data.id, fraud.data.target, fraud.data.checksum);
                queue(tokens, false);
            }
            break;
    }
}
