import { Priority, Task, Timer } from "@clarity-types/core";
import { Code, Event, Metric, Severity } from "@clarity-types/data";
import { Constant, MutationHistory, MutationQueue, Setting, Source } from "@clarity-types/layout";
import api from "@src/core/api";
import * as core from "@src/core";
import { bind } from "@src/core/event";
import measure from "@src/core/measure";
import * as task from "@src/core/task";
import { time } from "@src/core/time";
import { clearTimeout, setTimeout } from "@src/core/timeout";
import { id } from "@src/data/metadata";
import * as summary from "@src/data/summary";
import * as internal from "@src/diagnostic/internal";
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
let attachShadow: (init: ShadowRootInit)  => ShadowRoot = null;
let animate: (keyframes: Keyframe[] | Keyframe, options: KeyframeEffectOptions) => Animation = null;
let queue: Node[] = [];
let timeout: number = null;
let activePeriod = null;
let history: MutationHistory = {};

// TODO (samart): think we should have an animation module probably
let animationPlay: () => void = null;
let animationPause: () => void = null;
let animationCancel: () => void = null;
let animationFinish: () => void = null;
let animationUpdateTiming: () => void = null;
let animationSetKeyFrames: () => void = null;

function overrideAnimationHelper(whereToStoreFunction: () => void, name: string) {
  if (whereToStoreFunction === null) {
    whereToStoreFunction = Animation.prototype[name];
    Animation.prototype[name] = function(): void {
      console.log(`samart here are animate ${name}`);
      console.log(arguments);
      return whereToStoreFunction.apply(this, arguments);
    }
  }
}

export function start(): void {
    observers = [];
    queue = [];
    timeout = null;
    activePeriod = 0;
    history = {};

    overrideAnimationHelper(animationPlay, "play");
    overrideAnimationHelper(animationPause, "pause");
    overrideAnimationHelper(animationCancel, "cancel");
    overrideAnimationHelper(animationFinish, "finish");
    overrideAnimationHelper(animationUpdateTiming, "updateTiming");
    overrideAnimationHelper(animationSetKeyFrames, "setKeyFrames");

    // Some popular open source libraries, like styled-components, optimize performance
    // by injecting CSS using insertRule API vs. appending text node. A side effect of
    // using javascript API is that it doesn't trigger DOM mutation and therefore we
    // need to override the insertRule API and listen for changes manually.
    if (insertRule === null) { 
      insertRule = CSSStyleSheet.prototype.insertRule; 
      CSSStyleSheet.prototype.insertRule = function(): number {
        if (core.active()) { schedule(this.ownerNode); }
        return insertRule.apply(this, arguments);
      };
    }

    if (deleteRule === null) { 
      deleteRule = CSSStyleSheet.prototype.deleteRule;
      CSSStyleSheet.prototype.deleteRule = function(): void {
        if (core.active()) { schedule(this.ownerNode); }
        return deleteRule.apply(this, arguments);
      };
   }

    if (animate === null) {
      animate = Element.prototype.animate;
      Element.prototype.animate = function(): Animation {
        console.log('samart here are animate things');
        console.log(arguments);
        return animate.apply(this, arguments);
      }
    }

   // Add a hook to attachShadow API calls
   // In case we are unable to add a hook and browser throws an exception,
   // reset attachShadow variable and resume processing like before
   if (attachShadow === null) { 
     attachShadow = Element.prototype.attachShadow;    
     try {
       Element.prototype.attachShadow = function (): ShadowRoot {
         if (core.active()) { return schedule(attachShadow.apply(this, arguments)) as ShadowRoot; }
         else { return attachShadow.apply(this, arguments)}   
       }
     } catch { attachShadow = null; }
  } 
}

export function observe(node: Node): void {
  // Create a new observer for every time a new DOM tree (e.g. root document or shadowdom root) is discovered on the page
  // In the case of shadow dom, any mutations that happen within the shadow dom are not bubbled up to the host document
  // For this reason, we need to wire up mutations every time we see a new shadow dom.
  // Also, wrap it inside a try / catch. In certain browsers (e.g. legacy Edge), observer on shadow dom can throw errors
  try {
    let m = api(Constant.MutationObserver);
    let observer =  m in window ? new window[m](measure(handle) as MutationCallback) : null;
    if (observer) {
      observer.observe(node, { attributes: true, childList: true, characterData: true, subtree: true });
      observers.push(observer);
    }
  } catch (e) { internal.log(Code.MutationObserver, Severity.Info, e ? e.name : null); }
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
      setTimeout(doc.compute)
      measure(region.compute)();
  });
}

async function process(): Promise<void> {
  let timer: Timer = { id: id(), cost: Metric.LayoutCost };
  task.start(timer);
  while (mutations.length > 0) {
    let record = mutations.shift();
    let instance = time();
    for (let mutation of record.mutations) {
      let state = task.state(timer);
      if (state === Task.Wait) { state = await task.suspend(timer); }
      if (state === Task.Stop) { break; }      
      let target = mutation.target;
      let type = track(mutation, timer, instance);
      if (type && target && target.ownerDocument) { dom.parse(target.ownerDocument); }
      if (type && target && target.nodeType == Node.DOCUMENT_FRAGMENT_NODE && (target as ShadowRoot).host) { dom.parse(target as ShadowRoot); }
      switch (type) {
        case Constant.Attributes:
            processNode(target, Source.Attributes);
            break;
        case Constant.CharacterData:
            processNode(target, Source.CharacterData);
            break;
        case Constant.ChildList:
          processNodeList(mutation.addedNodes, Source.ChildListAdd, timer);
          processNodeList(mutation.removedNodes, Source.ChildListRemove, timer);
          break;
        case Constant.Suspend:
          let value = dom.get(target);
          if (value) { value.metadata.suspend = true; }
          break;
        default:
          break;
      }
    }
    await encode(Event.Mutation, timer, record.time);
  }
  task.stop(timer);
}

function track(m: MutationRecord, timer: Timer, instance: number): string {
  let value = m.target ? dom.get(m.target.parentNode) : null;
  // Check if the parent is already discovered and that the parent is not the document root
  if (value && value.data.tag !== Constant.HTML) {
    let inactive = time() > activePeriod;
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
    if (inactive === false && h[0] >= Setting.MutationSuspendThreshold) { processNodeList(h[2], Source.ChildListRemove, timer); }
    // Update the counter
    h[0] = inactive ? (h[1] === instance ? h[0] : h[0] + 1) : 1;
    h[1] = instance;
    // Return updated mutation type based on if we have already hit the threshold or not
    if (h[0] === Setting.MutationSuspendThreshold) {
      // Store a reference to removedNodes so we can process them later
      // when we resume mutations again on user interactions
      h[2] = m.removedNodes;
      return Constant.Suspend;
    } else if (h[0] > Setting.MutationSuspendThreshold) { 
      return Constant.Empty; 
    }
  }
  return m.type;
}

function names(nodes: NodeList): string {
  let output: string[] = [];
  for (let i = 0; nodes && i < nodes.length; i++) { output.push(nodes[i].nodeName); }
  return output.join();
}

async function processNodeList(list: NodeList, source: Source, timer: Timer): Promise<void> {
  let length = list ? list.length : 0;
  for (let i = 0; i < length; i++) {
    if (source === Source.ChildListAdd) {
      traverse(list[i], timer, source);
    } else {
      let state = task.state(timer);
      if (state === Task.Wait) { state = await task.suspend(timer); }
      if (state === Task.Stop) { break; }
      processNode(list[i], source);
    }
  }
}

export function schedule(node: Node): Node {
  // Only schedule manual trigger for this node if it's not already in the queue
  if (queue.indexOf(node) < 0) { queue.push(node); }

  // Cancel any previous trigger before scheduling a new one.
  // It's common for a webpage to call multiple synchronous "insertRule" / "deleteRule" calls.
  // And in those cases we do not wish to monitor changes multiple times for the same node.
  if (timeout) { clearTimeout(timeout); }
  timeout = setTimeout(() => { trigger() }, Setting.LookAhead);

  return node;
}

function trigger(): void {
  for (let node of queue) {
    // Generate a mutation for this node only if it still exists
    if (node) {
      let shadowRoot = node.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
      // Skip re-processing shadowRoot if it was already discovered
      if (shadowRoot && dom.has(node)) { continue; }
      generate(node, shadowRoot ? Constant.ChildList : Constant.CharacterData);
    }
  }
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
