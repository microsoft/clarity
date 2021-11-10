import * as Core from "./core";
import * as Data from "./data";
import * as Diagnostic from "./diagnostic";
import * as Layout from "./layout";
import * as Interaction from "./interaction";
import * as Performance from "./performance";

interface Clarity {
  start: (config?: Core.Config) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  upgrade: (key: string) => void;
  consent: () => void;
  event: (name: string, value: string) => void;
  set: (variable: string, value: string | string[]) => void;
  identify: (userId: string, sessionId?: string, pageId?: string) => void;
  metadata: (callback: Data.MetadataCallback, wait?: boolean) => void;
}

interface Helper {
  get: (node: Node) => Layout.NodeValue;
  getNode: (id: number) => Node;
  hash: (input: string) => string;
  lookup: (hash: string) => number;
  selector: (input: Layout.SelectorInput, beta?: boolean) => string;
}

declare const clarity: Clarity;
declare const helper: Helper;
declare const version: string;

export { clarity, version, helper, Core, Data, Diagnostic, Layout, Interaction, Performance };
