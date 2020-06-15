import { Constant, Dimension, Metadata, Metric, BooleanFlag } from "@clarity-types/data";
import config from "@src/core/config";
import * as dimension from "@src/data/dimension";
import * as metric from "@src/data/metric";
import hash from "@src/data/hash";

export let data: Metadata = null;

export function start(): void {
  const ts = Math.round(Date.now()); // ensuring that the output of Date.now() is an integer
  const ua = navigator && "userAgent" in navigator ? navigator.userAgent : Constant.EMPTY_STRING;
  const title = document && document.title ? document.title : Constant.EMPTY_STRING;

  // Populate ids for this page
  let s = session(ts);
  data = {
    projectId: config.projectId || hash(location.host),
    userId: user(),
    sessionId: s[0],
    pageNum: s[1]
  }

  // Log dimensions
  dimension.log(Dimension.UserAgent, ua);
  dimension.log(Dimension.PageTitle, title);

  // Metrics
  metric.max(Metric.ClientTimestamp, ts);
  metric.max(Metric.Playback, config.lean ? BooleanFlag.False : BooleanFlag.True);

  // Track ids using a cookie if configuration allows it
  track();
}

export function end(): void {
  /* Intentionally Blank */
}

export function metadata(): Metadata {
  return data;
}

export function consent(): void {
  config.track = true;
  track();
}

function track(): void {
  if (config.track) {
    let expiry = new Date();
    expiry.setDate(expiry.getDate() + config.expire);
    let expires = expiry ? Constant.EXPIRES + expiry.toUTCString() : Constant.EMPTY_STRING;
    let value = data.userId + Constant.SEMICOLON + expires + Constant.PATH;
    document.cookie = Constant.STORAGE_KEY + Constant.EQUALS + value;
  }
}

// Credit: http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
// Excluding 3rd party code from tslint
// tslint:disable
function shortid() {
  let d = new Date().getTime();
  if (window.performance && performance.now) {
    // Use high-precision timer if available
    d += performance.now();
  }
  let uuid = "xxxx4xyx".replace(/[xy]/g, function (c) {
    let r = (d + Math.random() * 36) % 36 | 0;
    d = Math.floor(d / 36);
    return str((c == "x" ? r : (r & 0x3 | 0x8)));
  });
  return uuid;
}
// tslint:enable

function session(ts: number): number[] {
  let id = shortid();
  let count = 1;
  if (config.track && sessionStorage) {
    let value = sessionStorage.getItem(Constant.STORAGE_KEY);
    if (value && value.indexOf(Constant.STORAGE_SEPARATOR) >= 0) {
      let parts = value.split(Constant.STORAGE_SEPARATOR);
      if (parts.length === 3 && ts - num(parts[1], 10) < config.session) {
        id = parts[0];
        count = num(parts[2]) + 1;
      }
    }
    sessionStorage.setItem(Constant.STORAGE_KEY, `${id}${Constant.STORAGE_SEPARATOR}${ts}${Constant.STORAGE_SEPARATOR}${str(count)}`);
  }
  return [num(id), count];
}

function str(number: number, base: number = 36): string {
  return number.toString(base);
}

function num(string: string, base: number = 36): number {
  return parseInt(string, base);
}

function user(): number {
  let id;
  let cookies: string[] = document.cookie.split(Constant.SEMICOLON);
  if (cookies) {
    for (let i = 0; i < cookies.length; i++) {
      let pair: string[] = cookies[i].split(Constant.EQUALS);
      if (pair.length > 1 && pair[0].indexOf(Constant.STORAGE_KEY) >= 0 && pair[1].length === 8) {
        id = pair[1];
      }
    }
  }
  return num(id || shortid());
}
