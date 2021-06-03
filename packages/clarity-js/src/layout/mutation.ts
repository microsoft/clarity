import { Priority } from "@clarity-types/core";
import { Code, Event, Metric, Severity } from "@clarity-types/data";
import { Constant, MutationHistory, MutationQueue, Setting, Source } from "@clarity-types/layout";
import { bind } from "@src/core/event";
import measure from "@src/core/measure";
import * as task from "@src/core/task";
import { time } from "@src/core/time";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import * as summary from "@src/data/summary";
import * as log from "@src/diagnostic/log";
import * as doc from "@src/layout/document";
import * as dom from "@src/layout/dom";
import encode from "@src/layout/encode";
import * as region from "@src/layout/region";
import traverse from "@src/layout/traverse";
import processNode from "./node";

let observers: MutationObserver[] = [];
let mutations: MutationQueue[] = [];
let insertRule: (rule: string, index?: number) => number = null;
let deleteRule: (index?: number) => void = null;
let queue: Node[] = [];
let timeout: number = null;
let activePeriod = null;
let history: MutationHistory = {};


export function start(): void {
    observers = [];
    queue = [];
    timeout = null;
    activePeriod = 0;
    history = {};

    if (insertRule === null) { insertRule = CSSStyleSheet.prototype.insertRule; }
    if (deleteRule === null) { deleteRule = CSSStyleSheet.prototype.deleteRule; }

    // Some popular open source libraries, like styled-components, optimize performance
    // by injecting CSS using insertRule API vs. appending text node. A side effect of
    // using javascript API is that it doesn't trigger DOM mutation and therefore we
    // need to override the insertRule API and listen for changes manually.
    CSSStyleSheet.prototype.insertRule = function(): number {
      schedule(this.ownerNode);
      return insertRule.apply(this, arguments);
    };

    CSSStyleSheet.prototype.deleteRule = function(): void {
      schedule(this.ownerNode);
      return deleteRule.apply(this, arguments);
    };
}

export function observe(node: Node): void {
  // Create a new observer for every time a new DOM tree (e.g. root document or shadowdom root) is discovered on the page
  // In the case of shadow dom, any mutations that happen within the shadow dom are not bubbled up to the host document
  // For this reason, we need to wire up mutations every time we see a new shadow dom.
  // Also, wrap it inside a try / catch. In certain browsers (e.g. legacy Edge), observer on shadow dom can throw errors
  try {
    // In an edge case, it's possible to get stuck into infinite Mutation loop within Angular applications
    // This appears to be an issue with Zone.js package, see: https://github.com/angular/angular/issues/31712
    // As a temporary work around, ensuring Clarity can invoke MutationObserver outside of Zone (and use native implementation instead)
    let api: string = window[Constant.Zone] && Constant.Symbol in window[Constant.Zone] ? window[Constant.Zone][Constant.Symbol](Constant.MutationObserver) : Constant.MutationObserver;
    let observer =  api in window ? new window[api](measure(handle) as MutationCallback) : null;
    if (observer) {
      observer.observe(node, { attributes: true, childList: true, characterData: true, subtree: true });
      observers.push(observer);
    }
  } catch (error) { log.log(Code.MutationObserver, error, Severity.Info); }
}

export function monitor(frame: HTMLIFrameElement): void {
  // Bind to iframe's onload event so we get notified anytime there's an update to iframe content.
  // This includes cases where iframe location is updated without explicitly updating src attribute
  // E.g. iframe.contentWindow.location.href = "new-location";
  if (dom.has(frame) === false) {
    bind(frame, Constant.LoadEvent, generate.bind(this, frame, Constant.ChildList), true);
  }
}

export function stop(): void {
  for (let observer of observers) { if (observer) { observer.disconnect(); } }
  observers = [];

  // Restoring original insertRule
  if (insertRule !== null) {
    CSSStyleSheet.prototype.insertRule = insertRule;
    insertRule = null;
  }

  // Restoring original deleteRule
  if (deleteRule !== null) {
    CSSStyleSheet.prototype.deleteRule = deleteRule;
    deleteRule = null;
  }

  history = {};
  mutations = [];
  queue = [];
  activePeriod = 0;
  timeout = null;
}

export function active(): void {
  activePeriod = time() + Setting.MutationActivePeriod;
}

function handle(m: MutationRecord[]): void {
  // Queue up mutation records for asynchronous processing
  let now = time();
  summary.track(Event.Mutation, now);
  mutations.push({ time: now, mutations: m});
  task.schedule(process, Priority.High).then((): void => {
      measure(doc.compute)();
      measure(region.compute)();
  });
}

async function process(): Promise<void> {
    let timer = Metric.LayoutCost;
    task.start(timer);
    while (mutations.length > 0) {
      let record = mutations.shift();
      for (let mutation of record.mutations) {
        let target = mutation.target;
        let type = track(mutation, timer);
        if (type && target && target.ownerDocument) { dom.parse(target.ownerDocument); }
        switch (type) {
          case Constant.Attributes:
              if (task.shouldYield(timer)) { await task.suspend(timer); }
              processNode(target, Source.Attributes);
              break;
          case Constant.CharacterData:
              if (task.shouldYield(timer)) { await task.suspend(timer); }
              processNode(target, Source.CharacterData);
              break;
          case Constant.ChildList:
            processNodeList(mutation.addedNodes, Source.ChildListAdd, timer);
            processNodeList(mutation.removedNodes, Source.ChildListRemove, timer);
            break;
          case Constant.Suspend:
            let value = dom.get(target);
            if (value) { value.data.tag = Constant.SuspendMutationTag; }
            break;
          default:
            break;
        }
      }
      await encode(Event.Mutation, record.time);
    }
    task.stop(timer);
}

function track(m: MutationRecord, timer: Metric): string {
  let value = m.target ? dom.get(m.target.parentNode) : null;
  if (value) {
    let inactive = time() > activePeriod;
    // We use selector, instead of id, to determine the key because in some cases
    // repeated mutations can cause elements to be destroyed and then recreated as new DOM nodes
    // In those cases, IDs will change however the selector (which is relative to DOM xPath) remains the same
    let key = [value.selector, m.attributeName, m.addedNodes ? m.addedNodes.length : 0, m.removedNodes ? m.removedNodes.length : 0].join();
    // Initialize an entry if it doesn't already exist
    history[key] = key in history ? history[key] : [0];
    // Lookup any pending nodes queued up for removal, and process them now if we had suspended a mutation before
    if (inactive === false && history[key][0] >= Setting.MutationSuspendThreshold) { processNodeList(history[key][1], Source.ChildListRemove, timer); }
    // Update the counter
    history[key][0] = inactive ? history[key][0] + 1 : 1;
    // Return updated mutation type based on if we have already hit the threshold or not
    if (history[key][0] === Setting.MutationSuspendThreshold) {
      // Store a reference to removedNodes so we can process them later
      history[key][1] = m.removedNodes;
      return Constant.Suspend;
    } else if (history[key][0] > Setting.MutationSuspendThreshold) { return Constant.Empty; }
  }
  return m.type;
}

async function processNodeList(list: NodeList, source: Source, timer: Metric): Promise<void> {
  let length = list ? list.length : 0;
  for (let i = 0; i < length; i++) {
    if (source === Source.ChildListAdd) {
      traverse(list[i], timer, source);
    } else {
      if (task.shouldYield(timer)) { await task.suspend(timer); }
      processNode(list[i], source);
    }
  }
}

function schedule(node: Node): void {
  // Only schedule manual trigger for this node if it's not already in the queue
  if (queue.indexOf(node) < 0) { queue.push(node); }

  // Cancel any previous trigger before scheduling a new one.
  // It's common for a webpage to call multiple synchronous "insertRule" / "deleteRule" calls.
  // And in those cases we do not wish to monitor changes multiple times for the same node.
  if (timeout) { clearTimeout(timeout); }
  timeout = setTimeout(trigger, Setting.LookAhead);
}

function trigger(): void {
  for (let node of queue) { generate(node, Constant.CharacterData); }
  queue = [];
}

function generate(target: Node, type: MutationRecordType): void {
  measure(handle)([{
    addedNodes: [target],
    attributeName: null,
    attributeNamespace: null,
    nextSibling: null,
    oldValue: null,
    previousSibling: null,
    removedNodes: [],
    target,
    type
  }]);
}
