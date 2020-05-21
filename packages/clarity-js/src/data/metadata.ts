import { BooleanFlag, Envelope, Event, Metadata, PageState, PageData, Token, Upload } from "@clarity-types/data";
import config from "@src/core/config";
import version from "@src/core/version";
import encode from "@src/data/encode";
import hash from "@src/data/hash";

const CLARITY_STORAGE_KEY: string = "_clarity";
const CLARITY_STORAGE_SEPARATOR: string = "|";
export let state: PageState = null;

export function start(): void {
    let ts = Math.round(Date.now()); // ensuring that the output of Date.now() is an integer
    let projectId = config.projectId || hash(location.host);
    let userId = user();
    let sessionId = session(ts);
    let pageId = guid();
    let ua = navigator && "userAgent" in navigator ? navigator.userAgent : "";
    let upload = Upload.Async;
    let lean = config.lean ? BooleanFlag.True : BooleanFlag.False;
    let title = document && document.title ? document.title : null;
    let e: Envelope = { sequence: 0, version, pageId, userId, sessionId, projectId, upload, end: BooleanFlag.False };
    let p: PageData = { timestamp: ts, ua, url: location.href, referrer: document.referrer, lean, title };

    state = { page: p, envelope: e };
    track();
    encode(Event.Page);

    // For backward compatibility (starting 0.5.7)
    // This configuration option "onstart" will be removed in subsequent versions
    // And, is replaced by clarity.metadata() call.
    if (config.onstart) { config.onstart({ projectId, userId, sessionId, pageId}); }
}

export function end(): void {
    state = null;
}

export function metadata(): Metadata {
  let e = state ? state.envelope : null;
  return e ? {
    projectId: e.projectId,
    userId: e.userId,
    sessionId: e.sessionId,
    pageId: e.pageId
  } : null;
}

export function envelope(last: boolean): Token[] {
    let e = state.envelope;
    e.upload = last && "sendBeacon" in navigator ? Upload.Beacon : Upload.Async;
    e.end = last ? BooleanFlag.True : BooleanFlag.False;
    e.sequence++;

    return [e.sequence, e.version, e.projectId, e.userId, e.sessionId, e.pageId, e.upload, e.end];
}

export function consent(): void {
  config.track = true;
  track();
}

function track(): void {
  if (config.track) {
    let expiry = new Date();
    expiry.setDate(expiry.getDate() + config.expire);
    let expires = expiry ? "expires=" + expiry.toUTCString() : "";
    let value = state.envelope.userId + ";" + expires + ";path=/";
    document.cookie = CLARITY_STORAGE_KEY + "=" + value;
  }
}

// Credit: http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
// Excluding 3rd party code from tslint
// tslint:disable
function guid() {
  let d = new Date().getTime();
  if (window.performance && performance.now) {
    // Use high-precision timer if available
    d += performance.now(); 
  }
  let uuid = "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    let r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return str((c == "x" ? r : (r & 0x3 | 0x8)), 16);
  });
  return uuid;
}
// tslint:enable

function session(ts: number): string {
  let id = str(ts, 36);
  if (config.track && sessionStorage) {
    let value = sessionStorage.getItem(CLARITY_STORAGE_KEY);
    if (value && value.indexOf(CLARITY_STORAGE_SEPARATOR) >= 0) {
      let parts = value.split(CLARITY_STORAGE_SEPARATOR);
      if (parts.length === 2 && ts - parseInt(parts[1], 10) < config.session) { id = parts[0]; }
    }
    sessionStorage.setItem(CLARITY_STORAGE_KEY, `${id}${CLARITY_STORAGE_SEPARATOR}${ts}`);
  }
  return id;
}

function str(number: number, base: number = 10): string {
  return number.toString(base);
}

function user(): string {
  let id;
  let cookies: string[] = document.cookie.split(";");
  if (cookies) {
    for (let i = 0; i < cookies.length; i++) {
      let pair: string[] = cookies[i].split("=");
      if (pair.length > 1 && pair[0].indexOf(CLARITY_STORAGE_KEY) >= 0 && pair[1].length === 32) {
        id = pair[1];
      }
    }
  }
  return id ||  guid();
}
