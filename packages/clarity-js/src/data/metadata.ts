import { Time } from "@clarity-types/core";
import { BooleanFlag, Constant, Dimension, Metadata, MetadataCallback, Metric, Session, User, Setting } from "@clarity-types/data";
import * as core from "@src/core";
import config from "@src/core/config";
import hash from "@src/core/hash";
import * as dimension from "@src/data/dimension";
import * as metric from "@src/data/metric";
import { set } from "@src/data/variable";

export let data: Metadata = null;
export let callback: MetadataCallback = null;
let rootDomain = null;

export function start(): void {
  callback = null;
  rootDomain = null;
  const ua = navigator && "userAgent" in navigator ? navigator.userAgent : Constant.Empty;
  const title = document && document.title ? document.title : Constant.Empty;

  // Populate ids for this page
  let s = session();
  let u = user();
  data = {
    projectId: config.projectId || hash(location.host),
    userId: u.id,
    sessionId: s.session,
    pageNum: s.count
  }

  // Override configuration based on what's in the session storage, unless it is blank (e.g. using upload callback, like in devtools)
  config.lean = config.track && s.upgrade !== null ? s.upgrade === BooleanFlag.False : config.lean;
  config.upload = config.track && typeof config.upload === Constant.String && s.upload && s.upload.length > Constant.HTTPS.length ? s.upload : config.upload;
  // Log dimensions
  dimension.log(Dimension.UserAgent, ua);
  dimension.log(Dimension.PageTitle, title);
  dimension.log(Dimension.Url, location.href);
  dimension.log(Dimension.Referrer, document.referrer);
  dimension.log(Dimension.TabId, tab());
  dimension.log(Dimension.PageLanguage, document.documentElement.lang);
  dimension.log(Dimension.DocumentDirection, document.dir);
  if (navigator) {
    dimension.log(Dimension.Language, (<any>navigator).userLanguage || navigator.language);
    metric.max(Metric.Automation, navigator.webdriver ? BooleanFlag.True : BooleanFlag.False);
    userAgentData();
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
  track(u);
}

export function userAgentData(): void {
  if (navigator["userAgentData"] && navigator["userAgentData"].getHighEntropyValues) {
    navigator["userAgentData"].getHighEntropyValues(
      ["model",
      "platform",
      "platformVersion",
      "uaFullVersion"])
      .then(ua => { 
        dimension.log(Dimension.Platform, ua.platform); 
        dimension.log(Dimension.PlatformVersion, ua.platformVersion); 
        ua.brands?.forEach(brand => {
          dimension.log(Dimension.Brand, brand.name + Constant.Tilde + brand.version); 
        });
        dimension.log(Dimension.Model, ua.model); 
        metric.max(Metric.Mobile, ua.mobile ? BooleanFlag.True : BooleanFlag.False); 
      });
  }
}

export function stop(): void {
  callback = null;
  rootDomain = null;
  data = null;
}

export function metadata(cb: MetadataCallback, wait: boolean = true): void {
  if (data && wait === false) {
    // Immediately invoke the callback if the caller explicitly doesn't want to wait for the upgrade confirmation
    cb(data, !config.lean);
  } else {
    // Save the callback for future reference; so we can inform the caller when page gets upgraded and we have a valid playback flag
    callback = cb;
  }
}

export function id(): string {
  return data ? [data.userId, data.sessionId, data.pageNum].join(Constant.Dot) : Constant.Empty;
}

export function consent(): void {
  if (core.active()) {
    config.track = true;
    track(user(), BooleanFlag.True);
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
  let upload = config.upload && typeof config.upload === Constant.String ? (config.upload as string).replace(Constant.HTTPS, Constant.Empty) : Constant.Empty;
  if (upgrade && callback) { callback(data, !config.lean); }
  setCookie(Constant.SessionKey, [data.sessionId, ts, data.pageNum, upgrade, upload].join(Constant.Pipe), Setting.SessionExpire);
}

function supported(target: Window | Document, api: string): boolean {
  try { return !!target[api]; } catch { return false; }
}

function track(u: User, consent: BooleanFlag = null): void {
  // If consent is not explicitly specified, infer it from the user object
  consent = consent === null ? u.consent : consent;
  // Convert time precision into days to reduce number of bytes we have to write in a cookie
  // E.g. Math.ceil(1628735962643 / (24*60*60*1000)) => 18852 (days) => ejo in base36 (13 bytes => 3 bytes)
  let end = Math.ceil((Date.now() + (Setting.Expire * Time.Day))/Time.Day);
  // To avoid cookie churn, write user id cookie only once every day
  if (u.expiry === null || Math.abs(end - u.expiry) >= Setting.CookieInterval || u.consent !== consent) {
    setCookie(Constant.CookieKey, [data.userId, Setting.CookieVersion, end.toString(36), consent].join(Constant.Pipe), Setting.Expire);
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
  let output: Session = { session: shortid(), ts: Math.round(Date.now()), count: 1, upgrade: null, upload: Constant.Empty };
  let value = getCookie(Constant.SessionKey);
  if (value) {
    let parts = value.split(Constant.Pipe);
    // Making it backward & forward compatible by using greater than comparison (v0.6.21)
    // In future version, we can reduce the parts length to be 5 where the last part contains the full upload URL
    if (parts.length >= 5 && output.ts - num(parts[1]) < Setting.SessionTimeout) {
      output.session = parts[0];
      output.count = num(parts[2]) + 1;
      output.upgrade = num(parts[3]);
      output.upload = parts.length >= 6 ? `${Constant.HTTPS}${parts[5]}/${parts[4]}` : `${Constant.HTTPS}${parts[4]}`;
    }
  }
  return output;
}

function num(string: string, base: number = 10): number {
  return parseInt(string, base);
}

function user(): User {
  let output: User = { id: shortid(), expiry: null, consent: BooleanFlag.False };
  let cookie = getCookie(Constant.CookieKey);
  if(cookie && cookie.length > 0) {
    // Splitting and looking up first part for forward compatibility, in case we wish to store additional information in a cookie
    let parts = cookie.split(Constant.Pipe);
    // For backward compatibility introduced in v0.6.18; following code can be removed with future iterations
    // Count number of times Clarity's user cookie crumb appears in document.cookie (could be on different sub-domains e.g. www.domain.com and .domain.com)
    let count = 0;
    for (let c of document.cookie.split(Constant.Semicolon)) { count += c.split(Constant.Equals)[0].trim() === Constant.CookieKey ? 1 : 0; }
    // Check if we either got version-less cookie value or saw multiple copies of the user cookie crumbs
    // In both these cases, we go ahead and delete the existing cookie set on current domain
    if (parts.length === 1 || count > 1) {
      let deleted = `${Constant.Semicolon}${Constant.Expires}${(new Date(0)).toUTCString()}${Constant.Path}`;
      // First, delete current user cookie which might be set on current sub-domain vs. root domain
      document.cookie = `${Constant.CookieKey}=${deleted}`;
      // Second, same thing for current session cookie so it can be re-written later with the root domain
      document.cookie = `${Constant.SessionKey}=${deleted}`;
    }
    // End code for backward compatibility
    // Read version information and timestamp from cookie, if available
    if (parts.length > 2) { output.expiry = num(parts[2], 36); }
    // Check if we have explicit consent to track this user
    if (parts.length > 3 && num(parts[3]) === 1) { output.consent = BooleanFlag.True; }
    // Set track configuration to true for this user if we have explicit consent, regardless of project setting
    config.track = config.track || output.consent === BooleanFlag.True;
    // Get user id from cookie only if we tracking is enabled, otherwise fallback to a random id
    output.id = config.track ? parts[0] : output.id;
  }
  return output;
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
  if (config.track && ((navigator && navigator.cookieEnabled) ||  supported(document, Constant.Cookie))) {
    let expiry = new Date();
    expiry.setDate(expiry.getDate() + time);
    let expires = expiry ? Constant.Expires + expiry.toUTCString() : Constant.Empty;
    let cookie = `${key}=${value}${Constant.Semicolon}${expires}${Constant.Path}`;
    try {
      // Attempt to get the root domain only once and fall back to writing cookie on the current domain.
      if (rootDomain === null) {
        let hostname = location.hostname ? location.hostname.split(Constant.Dot) : [];
        // Walk backwards on a domain and attempt to set a cookie, until successful
        for (let i = hostname.length - 1; i >= 0; i--) {
          rootDomain = `.${hostname[i]}${rootDomain ? rootDomain : Constant.Empty}`;
          // We do not wish to attempt writing a cookie on the absolute last part of the domain, e.g. .com or .net.
          // So we start attempting after second-last part, e.g. .domain.com (PASS) or .co.uk (FAIL)
          if (i < hostname.length - 1) { 
            // Write the cookie on the current computed top level domain
            document.cookie = `${cookie}${Constant.Semicolon}${Constant.Domain}${rootDomain}`;
            // Once written, check if the cookie exists and its value matches exactly with what we intended to set
            // Checking for exact value match helps us eliminate a corner case where the cookie may already be present with a different value
            // If the check is successful, no more action is required and we can return from the function since rootDomain cookie is already set
            // If the check fails, continue with the for loop until we can successfully set and verify the cookie
            if (getCookie(key) === value) { return; }
          }
        }
        // Finally, if we were not successful and gone through all the options, play it safe and reset rootDomain to be empty
        // This forces our code to fall back to always writing cookie to the current domain
        rootDomain = Constant.Empty;
      }
    } catch { rootDomain = Constant.Empty; }
    document.cookie = rootDomain ? `${cookie}${Constant.Semicolon}${Constant.Domain}${rootDomain}` : cookie;
  }
}
