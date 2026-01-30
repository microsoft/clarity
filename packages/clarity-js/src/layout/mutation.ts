import { Priority, Task, Timer } from "@clarity-types/core";
import { Code, Event, Metric, Severity } from "@clarity-types/data";
import { Constant, MutationHistory, MutationRecordWithTime, MutationQueue, Setting, Source } from "@clarity-types/layout";
import api from "@src/core/api";
import * as core from "@src/core";
import * as event from "@src/core/event";
import measure from "@src/core/measure";
import * as task from "@src/core/task";
import { time } from "@src/core/time";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import { id } from "@src/data/metadata";
import * as summary from "@src/data/summary";
import * as internal from "@src/diagnostic/internal";
import * as doc from "@src/layout/document";
import * as dom from "@src/layout/dom";
import * as metric from "@src/data/metric";
import encode from "@src/layout/encode";
import * as region from "@src/layout/region";
import traverse from "@src/layout/traverse";
import processNode from "./node";
import config from "@src/core/config";

let observers: Set<MutationObserver> = new Set();
let mutations: MutationQueue[] = [];
let throttledMutations: { [key: number]: MutationRecordWithTime } = {};
let queue: Node[] = [];
let timeout: number = null;
let throttleDelay: number = null;
let activePeriod = null;
let history: MutationHistory = {};
let observedNodes: WeakMap<Node, MutationObserver> = new WeakMap<Node, MutationObserver>();

// We ignore mutations if these attributes are updated
const IGNORED_ATTRIBUTES = ["data-google-query-id", "data-load-complete", "data-google-container-id"];

export function start(): void {
  observers = new Set();
  queue = [];
  timeout = null;
  activePeriod = 0;
  history = {};
  observedNodes = new WeakMap<Node, MutationObserver>();
  proxyStyleRules(window);
}

export function observe(node: Document | ShadowRoot): void {
  // Create a new observer for every time a new DOM tree (e.g. root document or shadowdom root) is discovered on the page
  // In the case of shadow dom, any mutations that happen within the shadow dom are not bubbled up to the host document
  // For this reason, we need to wire up mutations every time we see a new shadow dom.
  // Also, wrap it inside a try / catch. In certain browsers (e.g. legacy Edge), observer on shadow dom can throw errors
  try {

    let m = api(Constant.MutationObserver);
    let observer = m in window ? new window[m](measure(handle) as MutationCallback) : null;
    if (observer) {
      observer.observe(node, { attributes: true, childList: true, characterData: true, subtree: true });
      observedNodes.set(node, observer);
      observers.add(observer);
    }
    if (node['defaultView']) {
      proxyStyleRules(node['defaultView']);
    }
    
  } catch (e) {
    internal.log(Code.MutationObserver, Severity.Info, e ? e.name : null);
  }
}

export function monitor(frame: HTMLIFrameElement): void {
  // Bind to iframe's onload event so we get notified anytime there's an update to iframe content.
  // This includes cases where iframe location is updated without explicitly updating src attribute
  // E.g. iframe.contentWindow.location.href = "new-location";
  if (dom.has(frame) === false) {
    event.bind(frame, Constant.LoadEvent, generate.bind(this, frame, Constant.ChildList), true);
  }
}

export function stop(): void {
  for (let observer of Array.from(observers)) {
    if (observer) {
      observer.disconnect();
    }
  }
  observers = new Set();
  history = {};
  mutations = [];
  throttledMutations = {};
  queue = [];
  activePeriod = 0;
  timeout = null;
  observedNodes = new WeakMap();
}

export function active(): void {
  activePeriod = time() + Setting.MutationActivePeriod;
}

export function disconnect(n: Node): void {
  const ob = observedNodes.get(n);
  if (ob) {
    ob.disconnect();
    observers.delete(ob);
    observedNodes.delete(n);
  }
}

function handle(m: MutationRecord[]): void {
  // Queue up mutation records for asynchronous processing
  let now = time();
  summary.track(Event.Mutation, now);
  mutations.push({ time: now, mutations: m });
  task.schedule(process, Priority.High).then((): void => {
    setTimeout(doc.compute);
    measure(region.compute)();
  });
}

async function processMutation(timer: Timer, mutation: MutationRecord, instance: number, timestamp: number): Promise<void> {
  let state = task.state(timer);

  if (state === Task.Wait) {
    state = await task.suspend(timer);
  }
  if (state === Task.Stop) {
    return;
  }

  let target = mutation.target;
  let type = config.throttleDom ? track(mutation, timer, instance, timestamp) : mutation.type;

  if (type && target && target.ownerDocument) {
    dom.parse(target.ownerDocument);
  }

  if (type && target && target.nodeType == Node.DOCUMENT_FRAGMENT_NODE && (target as ShadowRoot).host) {
    dom.parse(target as ShadowRoot);
  }

  switch (type) {
    case Constant.Attributes:
      if (IGNORED_ATTRIBUTES.indexOf(mutation.attributeName) < 0) {
        processNode(target, Source.Attributes, timestamp);
      }
      break;
    case Constant.CharacterData:
      processNode(target, Source.CharacterData, timestamp);
      break;
    case Constant.ChildList:
      processNodeList(mutation.addedNodes, Source.ChildListAdd, timer, timestamp);
      processNodeList(mutation.removedNodes, Source.ChildListRemove, timer, timestamp);
      break;
    case Constant.Throttle:
    default:
      break;
  }
}
async function process(): Promise<void> {
  let timer: Timer = { id: id(), cost: Metric.LayoutCost };
  task.start(timer);
  while (mutations.length > 0) {
    let record = mutations.shift();
    let instance = time();
    for (let mutation of record.mutations) {
      await processMutation(timer, mutation, instance, record.time);
    }
    await encode(Event.Mutation, timer, record.time);
  }

  let processedMutations = false;
  for (var key of Object.keys(throttledMutations)) {
    let throttledMutationToProcess: MutationRecordWithTime = throttledMutations[key];
    delete throttledMutations[key];
    await processMutation(timer, throttledMutationToProcess.mutation, time(), throttledMutationToProcess.timestamp);
    processedMutations = true;
  }

  if (Object.keys(throttledMutations).length > 0) {
    processThrottledMutations();
  }

  // ensure we encode the previously throttled mutations once we have finished them
  if (Object.keys(throttledMutations).length === 0 && processedMutations) {
    await encode(Event.Mutation, timer, time());
  }

  cleanHistory();

  task.stop(timer);
}

function cleanHistory(): void {
  let now = time();
  if (Object.keys(history).length > Setting.MaxMutationHistoryCount) {
    history = {};
    metric.count(Metric.HistoryClear);
  }

  for (let key of Object.keys(history)) {
    let h = history[key];
    if (now > h[1] + Setting.MaxMutationHistoryTime) {
      delete history[key];
    }
  }
}

function track(m: MutationRecord, timer: Timer, instance: number, timestamp: number): string {
  let value = m.target ? dom.get(m.target.parentNode) : null;

  // Check if the parent is already discovered and that the parent is not the document root
  if (value && value.data.tag !== Constant.HTML) {
    // calculate inactive period based on the timestamp of the mutation not when the mutation is processed
    let inactive = timestamp > activePeriod;

    // Calculate critical period based on when mutation is processed
    let target = dom.get(m.target);
    let element = target && target.selector ? target.selector.join() : m.target.nodeName;
    let parent = value.selector ? value.selector.join() : Constant.Empty;

    // We use selector, instead of id, to determine the key (signature for the mutation) because in some cases
    // repeated mutations can cause elements to be destroyed and then recreated as new DOM nodes
    // In those cases, IDs will change however the selector (which is relative to DOM xPath) remains the same
    let key = [parent, element, m.attributeName, names(m.addedNodes), names(m.removedNodes)].join();

    // Initialize an entry if it doesn't already exist
    history[key] = key in history ? history[key] : [0, instance];
    let h = history[key];

    // Lookup any pending nodes queued up for removal, and process them now if we suspended a mutation before
    if (inactive === false && h[0] >= Setting.MutationSuspendThreshold) {
      processNodeList(h[2], Source.ChildListRemove, timer, timestamp);
    }

    // Update the counter, do not reset counter if its critical period
    h[0] = inactive ? (h[1] === instance ? h[0] : h[0] + 1) : 1;
    h[1] = instance;

    // Return updated mutation type based on,
    // 1. if we have already hit the threshold or not
    // 2. if its a low priority mutation happening during critical time period
    if (h[0] >= Setting.MutationSuspendThreshold) {
      // Store a reference to removedNodes so we can process them later
      // when we resume mutations again on user interactions
      h[2] = m.removedNodes;
      if (instance > timestamp + Setting.MutationActivePeriod) {
        return m.type;
      }

      // we only store the most recent mutation for a given key if it is being throttled
      throttledMutations[key] = { mutation: m, timestamp };

      return Constant.Throttle;
    }
  }
  return m.type;
}

function names(nodes: NodeList): string {
  let output: string[] = [];
  for (let i = 0; nodes && i < nodes.length; i++) {
    output.push(nodes[i].nodeName);
  }
  return output.join();
}

async function processNodeList(list: NodeList, source: Source, timer: Timer, timestamp: number): Promise<void> {
  let length = list ? list.length : 0;
  for (let i = 0; i < length; i++) {
    const node = list[i];
    if (source === Source.ChildListAdd) {
      traverse(node, timer, source, timestamp);
    } else {
      let state = task.state(timer);
      if (state === Task.Wait) {
        state = await task.suspend(timer);
      }
      if (state === Task.Stop) {
        break;
      }
      processNode(node, source, timestamp);
    }
  }
}

function processThrottledMutations(): void {
  if (throttleDelay) {
    clearTimeout(throttleDelay);
  }
  throttleDelay = setTimeout(() => {
    task.schedule(process, Priority.High);
  }, Setting.LookAhead);
}

export function schedule(node: Node): Node {
  // Only schedule manual trigger for this node if it's not already in the queue
  if (queue.indexOf(node) < 0) {
    queue.push(node);
  }

  // Cancel any previous trigger before scheduling a new one.
  // It's common for a webpage to call multiple synchronous "insertRule" / "deleteRule" calls.
  // And in those cases we do not wish to monitor changes multiple times for the same node.
  if (timeout) {
    clearTimeout(timeout);
  }
  timeout = setTimeout(() => {
    trigger();
  }, Setting.LookAhead);

  return node;
}

function trigger(): void {
  for (let node of queue) {
    // Generate a mutation for this node only if it still exists
    if (node) {
      let shadowRoot = node.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
      // Skip re-processing shadowRoot if it was already discovered
      if (shadowRoot && dom.has(node)) {
        continue;
      }
      generate(node, shadowRoot ? Constant.ChildList : Constant.CharacterData);
    }
  }
  queue = [];
}

function generate(target: Node, type: MutationRecordType): void {
  measure(handle)([
    {
      addedNodes: [target],
      attributeName: null,
      attributeNamespace: null,
      nextSibling: null,
      oldValue: null,
      previousSibling: null,
      removedNodes: [],
      target,
      type,
    },
  ]);
}


function proxyStyleRules(win: any): void {
  if (win === null || win === undefined) {
    return;
  }

  win.clarityOverrides = win.clarityOverrides || {};

  // Some popular open source libraries, like styled-components, optimize performance
  // by injecting CSS using insertRule API vs. appending text node. A side effect of
  // using javascript API is that it doesn't trigger DOM mutation and therefore we
  // need to override the insertRule API and listen for changes manually.
  if ("CSSStyleSheet" in win && win.CSSStyleSheet && win.CSSStyleSheet.prototype && win.clarityOverrides.InsertRule === undefined) {
    win.clarityOverrides.InsertRule = win.CSSStyleSheet.prototype.insertRule;
    win.CSSStyleSheet.prototype.insertRule = function (): number {
      if (core.active()) {
        schedule(this.ownerNode);
      }
      return win.clarityOverrides.InsertRule.apply(this, arguments);
    };
  }

  if ("CSSMediaRule" in win && win.CSSMediaRule && win.CSSMediaRule.prototype && win.clarityOverrides.MediaInsertRule === undefined) {
    win.clarityOverrides.MediaInsertRule = win.CSSMediaRule.prototype.insertRule;
    win.CSSMediaRule.prototype.insertRule = function (): number {
      if (core.active()) {
        schedule(this.parentStyleSheet.ownerNode);
      }
      return win.clarityOverrides.MediaInsertRule.apply(this, arguments);
    };
  }

  if ("CSSStyleSheet" in win && win.CSSStyleSheet && win.CSSStyleSheet.prototype && win.clarityOverrides.DeleteRule === undefined) {
    win.clarityOverrides.DeleteRule = win.CSSStyleSheet.prototype.deleteRule;
    win.CSSStyleSheet.prototype.deleteRule = function (): void {
      if (core.active()) {
        schedule(this.ownerNode);
      }
      return win.clarityOverrides.DeleteRule.apply(this, arguments);
    };
  }

  if ("CSSMediaRule" in win && win.CSSMediaRule && win.CSSMediaRule.prototype && win.clarityOverrides.MediaDeleteRule === undefined) {
    win.clarityOverrides.MediaDeleteRule = win.CSSMediaRule.prototype.deleteRule;
    win.CSSMediaRule.prototype.deleteRule = function (): void {
      if (core.active()) {
        schedule(this.parentStyleSheet.ownerNode);
      }
      return win.clarityOverrides.MediaDeleteRule.apply(this, arguments);
    };
  }

  // Add a hook to attachShadow API calls
  // In case we are unable to add a hook and browser throws an exception,
  // reset attachShadow variable and resume processing like before
  if ("Element" in win && win.Element && win.Element.prototype && win.clarityOverrides.AttachShadow === undefined) {
    win.clarityOverrides.AttachShadow = win.Element.prototype.attachShadow;
    try {
      win.Element.prototype.attachShadow = function (): ShadowRoot {
        if (core.active()) {
          return schedule(win.clarityOverrides.AttachShadow.apply(this, arguments)) as ShadowRoot;
        } else {
          return win.clarityOverrides.AttachShadow.apply(this, arguments);
        }
      };
    } catch {
      win.clarityOverrides.AttachShadow = null;
    }
  }
}