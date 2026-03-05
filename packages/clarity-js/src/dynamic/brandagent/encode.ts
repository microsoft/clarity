import { Event, Token } from "@clarity-types/data";
import { BrandAgentData } from "@clarity-types/data";
import { Privacy } from "@clarity-types/core";
import { text } from "@src/core/scrub";
import { Constant } from "@clarity-types/layout";

export default function (data: BrandAgentData): void {
  const t = (window as any).clarity("time");
  let tokens: Token[] = [t, Event.BrandAgent];
  tokens.push(data.name);
  tokens.push(data.msg ? text(data.msg, Constant.TextTag, Privacy.Sensitive) : Constant.Empty);
  tokens.push(data.cid || Constant.Empty);

  queueTokens(tokens);
}

function queueTokens(tokens: Token[]) {
  if (typeof window !== "undefined" && (window as any).clarity) {
    (window as any).clarity("queue", tokens);
  }
}
