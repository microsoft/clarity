import * as Core from "./core";
import * as Data from "./data";
import * as Diagnostic from "./diagnostic";
import * as Layout from "./layout";
import * as Interaction from "./interaction";
import * as Performance from "./performance";

interface Clarity {
  version: string;
  active: boolean;
  config: (config: Core.Config) => boolean;
  start: (config: Core.Config) => void;
  end: () => void;
  pause: () => void;
  resume: () => void;
  upgrade: (key: string) => void;
  consent: () => void;
  tag: (key: string, value: string) => void;
  metadata: () => Data.Metadata;
}

interface Helper {
  hash: (input: string) => number;
  selector: (tag: string, prefix: string, attributes: Layout.Attributes, position: number) => string;
}

declare const clarity: Clarity;
declare const helper: Helper;
declare const version: string;

export { clarity, version, helper, Core, Data, Diagnostic, Layout, Interaction, Performance };
