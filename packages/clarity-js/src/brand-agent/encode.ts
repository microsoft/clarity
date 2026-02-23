import { Constant, Event, Token } from "@clarity-types/data";
import { BrandAgentData } from "../../types/brand-agent";
import { text } from "../core/scrub";
import { queue } from "../clarity";
import { Privacy } from "../../types/core";
import { Layout } from "../../types";

export default function (data: BrandAgentData): void {
  const t = (window as any).clarity("time");
  let tokens: Token[] = [t, Event.BrandAgent];
  tokens.push(data.name);
  tokens.push(data.msg ? text(data.msg, Layout.Constant.TextTag, Privacy.Sensitive) : Constant.Empty);
  tokens.push(data.cid || Constant.Empty);

  queue(tokens);
}