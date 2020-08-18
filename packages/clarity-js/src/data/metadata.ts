import { Constant, Dimension, Metadata, Metric, BooleanFlag } from "@clarity-types/data";
import config from "@src/core/config";
import * as dimension from "@src/data/dimension";
import * as metric from "@src/data/metric";
import hash from "@src/data/hash";
import { set } from "@src/data/variable";

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

  // Check if the session should start off in full mode based on the signal from session storage
  config.lean = config.track && sessionStorage && sessionStorage.getItem(Constant.UPGRADE_KEY) ? false : config.lean;

  // Log dimensions
  dimension.log(Dimension.UserAgent, ua);
  dimension.log(Dimension.PageTitle, title);

  // Metrics
  metric.max(Metric.ClientTimestamp, ts);
  metric.max(Metric.Playback, config.lean ? BooleanFlag.False : BooleanFlag.True);

  // Read cookies specified in configuration
  for (let key of config.cookies) {
    let value = cookie(key);
    if (value) { set(key, value); }
  }

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
    let value = `${data.userId}${Constant.SEMICOLON}${expires}${Constant.PATH}`;
    document.cookie = Constant.CLARITY_COOKIE + Constant.EQUALS + value;
  }
}

function shortid(): number {
  if (window && window.crypto && window.crypto.getRandomValues && Uint32Array) {
    return window.crypto.getRandomValues(new Uint32Array(1))[0];
  } else {
    return Math.floor(Math.random() * Math.pow(2, 32));
  }
}

function session(ts: number): number[] {
  let id = shortid();
  let count = 1;
  if (config.track && sessionStorage) {
    let value = sessionStorage.getItem(Constant.STORAGE_KEY);
    if (value && value.indexOf(Constant.STORAGE_SEPARATOR) >= 0) {
      let parts = value.split(Constant.STORAGE_SEPARATOR);
      if (parts.length === 3 && ts - num(parts[1]) < config.session) {
        id = num(parts[0]);
        count = num(parts[2]) + 1;
      }
    }
    sessionStorage.setItem(Constant.STORAGE_KEY, `${id}${Constant.STORAGE_SEPARATOR}${ts}${Constant.STORAGE_SEPARATOR}${count}`);
  }
  return [id, count];
}

function num(string: string, base: number = 10): number {
  return parseInt(string, base);
}

function user(): number {
  let id = cookie(Constant.CLARITY_COOKIE);
  return id && id.length > 0 ? num(id) : shortid();
}

function cookie(key: string): string {
  let cookies: string[] = document.cookie.split(Constant.SEMICOLON);
  if (cookies) {
    for (let i = 0; i < cookies.length; i++) {
      let pair: string[] = cookies[i].split(Constant.EQUALS);
      if (pair.length > 1 && pair[0] && pair[0].trim() === key) {
        return pair[1];
      }
    }
  }
  return null;
}
