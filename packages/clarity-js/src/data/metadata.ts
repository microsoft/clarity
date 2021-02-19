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
    sessionId: s.id,
    pageNum: s.count
  }

  // Override configuration based on what's in the session storage
  config.lean = config.track && s.upgrade === BooleanFlag.True ? false : config.lean;
  config.upload = config.track && typeof config.upload === Constant.String && s.upload ? s.upload : config.upload;

  // Log dimensions
  dimension.log(Dimension.UserAgent, ua);
  dimension.log(Dimension.PageTitle, title);
  dimension.log(Dimension.Url, location.href);
  dimension.log(Dimension.Referrer, document.referrer);
  dimension.log(Dimension.Language, (<any>navigator).userLanguage || navigator.language);
  dimension.log(Dimension.ScreenWidth, `${screen.width || Constant.Empty}`);
  dimension.log(Dimension.ScreenHeight, `${screen.height || Constant.Empty}`);
  dimension.log(Dimension.ScreenColorDepth, `${screen && screen.colorDepth || Constant.Empty}`);
  addPerformanceDimensions();

  // Metrics
  metric.max(Metric.ClientTimestamp, s.ts);
  metric.max(Metric.Playback, BooleanFlag.False);

  // Read cookies specified in configuration
  for (let key of config.cookies) {
    let value = cookie(key);
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
  // Clear any stored information in the session so we can restart fresh the next time
  if (supported(window, Constant.SessionStorage)) { sessionStorage.removeItem(Constant.StorageKey); }
}

export function save(): void {
  let ts = Math.round(Date.now());
  let upgrade = config.lean ? BooleanFlag.False : BooleanFlag.True;
  let upload = typeof config.upload === Constant.String ? config.upload : Constant.Empty;
  if (upgrade && callback) { callback(data, !config.lean); }
  if (config.track && supported(window, Constant.SessionStorage)) {
    sessionStorage.setItem(Constant.StorageKey, [data.sessionId, ts, data.pageNum, upgrade, upload].join(Constant.Separator));
  }
}

function supported(target: Window | Document, api: string): boolean {
  try { return !!target[api]; } catch { return false; }
}

function track(): void {
  if (config.track && supported(document, Constant.Cookie)) {
    let expiry = new Date();
    expiry.setDate(expiry.getDate() + Setting.Expire);
    let expires = expiry ? Constant.Expires + expiry.toUTCString() : Constant.Empty;
    let value = `${data.userId}${Constant.Semicolon}${expires}${Constant.Path}`;
    document.cookie = Constant.CookieKey + Constant.Equals + value;
  }
}

function shortid(): string {
  let id = Math.floor(Math.random() * Math.pow(2, 32));
  if (window && window.crypto && window.crypto.getRandomValues && Uint32Array) {
    id = window.crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return id.toString(36);
}

function session(): Session {
  let output: Session = { id: shortid(), ts: Math.round(Date.now()), count: 1, upgrade: BooleanFlag.False, upload: Constant.Empty };
  if (config.track && supported(window, Constant.SessionStorage)) {
    let value = sessionStorage.getItem(Constant.StorageKey);
    if (value && value.indexOf(Constant.Separator) >= 0) {
      let parts = value.split(Constant.Separator);
      if (parts.length === 5 && output.ts - num(parts[1]) < Setting.SessionTimeout) {
        output.id = parts[0];
        output.count = num(parts[2]) + 1;
        output.upgrade = num(parts[3]);
        output.upload = parts[4];
      }
    }
  }
  return output;
}

function num(string: string, base: number = 10): number {
  return parseInt(string, base);
}

function user(): string {
  let id = cookie(Constant.CookieKey);
  return id && id.length > 0 ? id : shortid();
}

function cookie(key: string): string {
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

function addPerformanceDimensions(): void {
  if (performance) {
    var endEventTime = performance.timing.domContentLoadedEventEnd;
    if (performance.timing.loadEventEnd) {
      endEventTime = performance.timing.loadEventEnd;
    }

    //If we arent able to determine the end of the load time don"t send performance metrics
    if (endEventTime !== undefined && endEventTime !== 0) {
      var loadTime = (endEventTime - performance.timing.navigationStart);
      dimension.log(Dimension.LoadTime, `${loadTime}`);
    }

    if ((performance.timing != null)) {
      // list of 21 timing attributes to collect
      var pList = ['navigationStart', 'unloadEventStart', 'unloadEventEnd', 'redirectStart', 'redirectEnd', 'fetchStart',
        'domainLookupStart', 'domainLookupEnd', 'connectStart', 'connectEnd', 'secureConnectionStart', 'requestStart', 'responseStart',
        'responseEnd', 'domLoading', 'domInteractive', 'domContentLoadedEventStart', 'domContentLoadedEventEnd', 'domComplete',
        'loadEventStart', 'loadEventEnd'];

      // start time (for diff calculation)
      var s = performance.timing[pList[0]];

      var pt = s;
      for (var i = 1; i < pList.length; i++) {
        var attr = performance.timing[pList[i]];
        pt += ',';

        // empty if zero or undefined, otherwise diff between param and start time
        pt += (attr == null || attr === 0) ? '' : attr - s;
      }

      // limit total length of performance timing parameter to 150
      if (pt.length <= 150) {
        dimension.log(Dimension.PageTimings, `${pt}`);
      }

      if (performance.navigation != null) {
        dimension.log(Dimension.NavigationAttributes, performance.navigation.type + ',' + performance.navigation.redirectCount);
      }
    }
  }
};
