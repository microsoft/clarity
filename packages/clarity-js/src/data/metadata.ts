import { BooleanFlag, Constant, Dimension, Metadata, MetadataCallback, Metric, Session, Setting } from "@clarity-types/data";
import * as core from "@src/core";
import config from "@src/core/config";
import hash from "@src/core/hash";
import * as dimension from "@src/data/dimension";
import * as metric from "@src/data/metric";
import { set } from "@src/data/variable";

export let data: Metadata = null;
export let callback: MetadataCallback = null;

export function start(): void {
  callback = null;
  const ua = navigator && "userAgent" in navigator ? navigator.userAgent : Constant.Empty;
  const title = document && document.title ? document.title : Constant.Empty;

  // Populate ids for this page
  let s = session();
  data = {
    projectId: config.projectId || hash(location.host),
    userId: user(),
    sessionId: s.session,
    pageNum: s.count
  }

  // For backward compatibility; remove in future iterations (v0.6.11)
  if (config.upload && typeof config.upload === Constant.String && (config.upload as string).indexOf(Constant.HTTPS) === 0) {
    let url = config.upload as string;
    // Until 0.6.10, upload was expected to be complete URL. With 0.6.11, we send separate "server" config with hostname and path within "upload"
    // The code below checks if the "upload" value is complete URL, and if so, break it into "server" and "upload".
    config.server = url.substr(0, url.indexOf("/", Constant.HTTPS.length)); // Look for first "/" starting after initial "https://" string
    config.upload = config.server.length > 0 && config.server.length < url.length ? url.substr(config.server.length + 1) : url; // Grab path of the url and update "upload" configuration
  }

  // Override configuration based on what's in the session storage
  config.lean = config.track && s.upgrade === BooleanFlag.True ? false : config.lean;
  config.upload = config.track && typeof config.upload === Constant.String && s.upload ? s.upload : config.upload;


  // Log dimensions
  dimension.log(Dimension.UserAgent, ua);
  dimension.log(Dimension.PageTitle, title);
  dimension.log(Dimension.Url, location.href);
  dimension.log(Dimension.Referrer, document.referrer);
  dimension.log(Dimension.TabId, tab());
  dimension.log(Dimension.PageLanguage, document.documentElement.lang);
  if (navigator) {
    dimension.log(Dimension.Language, (<any>navigator).userLanguage || navigator.language);
  }

  // Metrics
  metric.max(Metric.ClientTimestamp, s.ts);
  metric.max(Metric.Playback, BooleanFlag.False);
  if (screen) {
    metric.max(Metric.ScreenWidth, Math.round(screen.width));
    metric.max(Metric.ScreenHeight, Math.round(screen.height));
    metric.max(Metric.ColorDepth, Math.round(screen.colorDepth));
  }

  // Read cookies specified in configuration
  for (let key of config.cookies) {
    let value = getCookie(key);
    if (value) { set(key, value); }
  }

  // Track ids using a cookie if configuration allows it
  track();
}

export function stop(): void {
  callback = null;
}

export function metadata(cb: MetadataCallback): void {
  callback = cb;
}

export function consent(): void {
  if (core.active()) {
    config.track = true;
    track();
  }
}

export function clear(): void {
  // Clear any stored information in the cookie that tracks session information so we can restart fresh the next time
  setCookie(Constant.SessionKey, Constant.Empty, 0);
}

function tab(): string {
  let id = shortid();
  if (config.track && supported(window, Constant.SessionStorage)) {
    let value = sessionStorage.getItem(Constant.TabKey);
    id = value ? value : id;
    sessionStorage.setItem(Constant.TabKey, id);
  }
  return id;
}

export function save(): void {
  let ts = Math.round(Date.now());
  let upgrade = config.lean ? BooleanFlag.False : BooleanFlag.True;
  let upload = typeof config.upload === Constant.String ? config.upload : Constant.Empty;
  if (upgrade && callback) { callback(data, !config.lean); }
  setCookie(Constant.SessionKey, [data.sessionId, ts, data.pageNum, upgrade, upload].join(Constant.Pipe), Setting.SessionExpire);

  // For backward compatibility - starting from v0.6.11. Can be removed in future versions.
  // This will ensure that older versions can still interpret and continue with sessions created with new version
  if (config.track && supported(window, Constant.SessionStorage)) {
    upload = typeof config.upload === Constant.String && config.server ? `${config.server}/${config.upload}` : upload;
    sessionStorage.setItem(Constant.SessionKey, [data.sessionId, ts, data.pageNum, upgrade, upload].join(Constant.Pipe));
  }
}

function supported(target: Window | Document, api: string): boolean {
  try { return !!target[api]; } catch { return false; }
}

function track(): void {
  setCookie(Constant.CookieKey, data.userId, Setting.Expire);
}

function shortid(): string {
  let id = Math.floor(Math.random() * Math.pow(2, 32));
  if (window && window.crypto && window.crypto.getRandomValues && Uint32Array) {
    id = window.crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return id.toString(36);
}

function session(): Session {
  let output: Session = { session: shortid(), ts: Math.round(Date.now()), count: 1, upgrade: BooleanFlag.False, upload: Constant.Empty };
  // In subsequent versions we will start reading cookies: getCookie(Constant.SessionKey)
  // For backward compatibility, we will continue reading from session storage in this version
  let legacy = supported(window, Constant.SessionStorage) ? sessionStorage.getItem(Constant.SessionKey) : null; // For backward compatibility
  let value = legacy;
  if (value) {
    let parts = value.split(Constant.Pipe);
    if (parts.length === 5 && output.ts - num(parts[1]) < Setting.SessionTimeout) {
      output.session = parts[0];
      output.count = num(parts[2]) + 1;
      output.upgrade = num(parts[3]);
      output.upload = parts[4];

      // For backward compatibility; remove in future iterations (v0.6.11)
      if (output.upload && output.upload.indexOf(Constant.HTTPS) === 0) {
        let url = output.upload;
        let server = url.substr(0, url.indexOf("/", Constant.HTTPS.length));
        output.upload = server.length > 0 && server.length < url.length ? url.substr(server.length + 1) : url;
      }
    }
  }
  return output;
}

function num(string: string, base: number = 10): number {
  return parseInt(string, base);
}

function user(): string {
  let id = getCookie(Constant.CookieKey);
  // Splitting and looking up first part for forward compatibility, in case we wish to store additional information in a cookie
  return id && id.length > 0 ? id.split(Constant.Pipe)[0] : shortid(); 
}

function getCookie(key: string): string {
  if (supported(document, Constant.Cookie)) {
    let cookies: string[] = document.cookie.split(Constant.Semicolon);
    if (cookies) {
      for (let i = 0; i < cookies.length; i++) {
        let pair: string[] = cookies[i].split(Constant.Equals);
        if (pair.length > 1 && pair[0] && pair[0].trim() === key) {
          return pair[1];
        }
      }
    }
  }
  return null;
}

function setCookie(key: string, value: string, time: number): void {
  if (config.track && supported(document, Constant.Cookie)) {
    let expiry = new Date();
    expiry.setDate(expiry.getDate() + time);
    let expires = expiry ? Constant.Expires + expiry.toUTCString() : Constant.Empty;
    document.cookie = `${key}=${value}${Constant.Semicolon}${expires}${Constant.Path}`;
  }
}
