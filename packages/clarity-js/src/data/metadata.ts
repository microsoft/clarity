import { Constant as CoreConstant, Time } from "@clarity-types/core";
import { BooleanFlag, ConsentData, ConsentSource, ConsentState, Constant, Dimension, Metadata, MetadataCallback, MetadataCallbackOptions, Metric, Session, Setting, User } from "@clarity-types/data";
import * as clarity from "@src/clarity";
import * as core from "@src/core";
import config from "@src/core/config";
import hash from "@src/core/hash";
import * as scrub from "@src/core/scrub";
import * as trackConsent from "@src/data/consent";
import { COOKIE_SEP, getCookie, setCookie } from "@src/data/cookie";
import * as dimension from "@src/data/dimension";
import * as metric from "@src/data/metric";
import { supported } from "@src/data/util";
import { set } from "@src/data/variable";

export let data: Metadata = null;
export let callbacks: MetadataCallbackOptions[] = [];
export let electron = BooleanFlag.False;
let consentStatus: ConsentState = null;
let cookiesLogged = false;
let defaultStatus: ConsentState = { source: ConsentSource.Default, ad_Storage: Constant.Denied, analytics_Storage: Constant.Denied };

export function start(): void {
  const ua = navigator && "userAgent" in navigator ? navigator.userAgent : Constant.Empty;
  const timezone = (typeof Intl !== 'undefined' && Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone) ?? '';
  const timezoneOffset = new Date().getTimezoneOffset().toString();
  const ancestorOrigins = window.location.ancestorOrigins ? Array.from(window.location.ancestorOrigins).toString() : '';
  const title = document && document.title ? document.title : Constant.Empty;
  electron = ua.indexOf(Constant.Electron) > 0 ? BooleanFlag.True : BooleanFlag.False;

  // Populate ids for this page
  let s = session();
  let u = user();
  let projectId = config.projectId || hash(location.host);
  data = { projectId, userId: u.id, sessionId: s.session, pageNum: s.count };

  // Override configuration based on what's in the session storage, unless it is blank (e.g. using upload callback, like in devtools)
  config.lean = config.track && s.upgrade !== null ? s.upgrade === BooleanFlag.False : config.lean;
  config.upload = config.track && typeof config.upload === Constant.String && s.upload && s.upload.length > Constant.HTTPS.length ? s.upload : config.upload;

  // Log page metadata as dimensions
  dimension.log(Dimension.UserAgent, ua);
  dimension.log(Dimension.PageTitle, title);
  dimension.log(Dimension.Url, scrub.url(location.href, !!electron));
  dimension.log(Dimension.Referrer, document.referrer);
  dimension.log(Dimension.TabId, tab());
  dimension.log(Dimension.PageLanguage, document.documentElement.lang);
  dimension.log(Dimension.DocumentDirection, document.dir);
  dimension.log(Dimension.DevicePixelRatio, `${window.devicePixelRatio}`);
  dimension.log(Dimension.Dob, u.dob.toString());
  dimension.log(Dimension.CookieVersion, u.version.toString());
  dimension.log(Dimension.AncestorOrigins, ancestorOrigins);
  dimension.log(Dimension.Timezone, timezone);
  dimension.log(Dimension.TimezoneOffset, timezoneOffset);

  // Capture additional metadata as metrics
  metric.max(Metric.ClientTimestamp, s.ts);
  metric.max(Metric.Playback, BooleanFlag.False);
  metric.max(Metric.Electron, electron);

  const zone = (window as any)?.[CoreConstant.Zone];
  const isZone = zone && CoreConstant.Symbol in zone;

  if (isZone) {
    metric.max(Metric.AngularZone, BooleanFlag.True);
  }

  // Capture navigator specific dimensions
  if (navigator) {
    dimension.log(Dimension.Language, navigator.language);
    metric.max(Metric.HardwareConcurrency, navigator.hardwareConcurrency);
    metric.max(Metric.MaxTouchPoints, navigator.maxTouchPoints);
    metric.max(Metric.DeviceMemory, Math.round((<any>navigator).deviceMemory));
    userAgentData();
  }

  if (screen) {
    metric.max(Metric.ScreenWidth, Math.round(screen.width));
    metric.max(Metric.ScreenHeight, Math.round(screen.height));
    metric.max(Metric.ColorDepth, Math.round(screen.colorDepth));
  }

  // Track consent config
  // If consent status is not already set, initialize it based on project configuration. Otherwise, use the existing consent status.
  if (consentStatus === null) {
    consentStatus = {
      source: u.consent ? ConsentSource.Cookie : ConsentSource.Implicit,
      ad_Storage: config.track ? Constant.Granted : Constant.Denied,
      analytics_Storage: config.track ? Constant.Granted : Constant.Denied,
    };
  }

  logCookies();

  const consent = getConsentData(consentStatus);
  trackConsent.config(consent);
  // Track ids using a cookie if configuration allows it
  track(u);
}

function userAgentData(): void {
  let uaData = navigator["userAgentData"];
  if (uaData && uaData.getHighEntropyValues) {
    uaData.getHighEntropyValues(["model", "platform", "platformVersion", "uaFullVersion"]).then(ua => {
      dimension.log(Dimension.Platform, ua.platform);
      dimension.log(Dimension.PlatformVersion, ua.platformVersion);
      ua.brands?.forEach(brand => { dimension.log(Dimension.Brand, brand.name + Constant.Tilde + brand.version); });
      dimension.log(Dimension.Model, ua.model);
      metric.max(Metric.Mobile, ua.mobile ? BooleanFlag.True : BooleanFlag.False);
    });
  } else { dimension.log(Dimension.Platform, navigator.platform); }
}

function logCookies(): void {
  // Only log cookies if both analytics_Storage and ad_Storage are granted, and we haven't already logged them
  if (cookiesLogged || consentStatus?.analytics_Storage !== Constant.Granted || consentStatus?.ad_Storage !== Constant.Granted) { return; }
  for (let key of config.cookies) {
    let value = getCookie(key);
    if (value) { set(key, value); }
  }
  cookiesLogged = true;
}

export function stop(): void {
  data = null;
  // Reset cookiesLogged so cookies are re-logged on restart. Each session generates new metadata
  // (sessionId, pageNum), and cookie values need to be recorded in the new session's data stream.
  cookiesLogged = false;
  callbacks.forEach(cb => { cb.called = false; });
}

export function metadata(cb: MetadataCallback, wait: boolean = true, recall: boolean = false, consentInfo: boolean = false): void {
  let upgraded = config.lean ? BooleanFlag.False : BooleanFlag.True;
  let called = false;
  // if caller hasn't specified that they want to skip waiting for upgrade but we've already upgraded, we need to
  // directly execute the callback in addition to adding to our list as we only process callbacks at the moment
  // we go through the upgrading flow.
  if (data && (upgraded || wait === false)) {
    // Immediately invoke the callback if the caller explicitly doesn't want to wait for the upgrade confirmation
    cb(data, !config.lean, consentInfo ? consentStatus : undefined);
    called = true;
  }
  if (recall || !called) {
    callbacks.push({ callback: cb, wait, recall, called, consentInfo });
  }
}

export function id(): string {
  return data ? [data.userId, data.sessionId, data.pageNum].join(Constant.Dot) : Constant.Empty;
}

//TODO: Remove this function once consentv2 is fully released
export function consent(status = true): void {
  if (!status) {
    consentv2({ source: ConsentSource.APIv1, ad_Storage: Constant.Denied, analytics_Storage: Constant.Denied });
    return;
  }

  consentv2({ source: ConsentSource.APIv1, ad_Storage: Constant.Granted, analytics_Storage: Constant.Granted });
}

export function consentv2(consentState: ConsentState = defaultStatus, source: number = ConsentSource.APIv2): void {
  // Guard against calling consent API when Clarity hasn't started (e.g., due to GPC)
  if (!core.active()) { return; }

  const updatedStatus = {
    source: consentState.source ?? source,
    ad_Storage: normalizeConsent(consentState.ad_Storage, consentStatus?.ad_Storage),
    analytics_Storage: normalizeConsent(consentState.analytics_Storage, consentStatus?.analytics_Storage),
  };

  if (
    consentStatus &&
    updatedStatus.ad_Storage === consentStatus.ad_Storage &&
    updatedStatus.analytics_Storage === consentStatus.analytics_Storage
  ) {
    consentStatus.source = updatedStatus.source;
    trackConsent.trackConsentv2(getConsentData(consentStatus));
    trackConsent.consent();
    return;
  }

  consentStatus = updatedStatus;
  callback(true);
  const consentData = getConsentData(consentStatus);

  if (!consentData.analytics_Storage && config.track) {
    config.track = false;
    clear(true);
    clarity.stop();
    window.setTimeout(clarity.start, Setting.RestartDelay);
    return;
  }

  if (core.active() && consentData.analytics_Storage) {
    config.track = true;
    track(user(), BooleanFlag.True);
    save();
  }

  logCookies();
  trackConsent.trackConsentv2(consentData);
  trackConsent.consent();
}

function getConsentData(consentState: ConsentState): ConsentData {
  let consent: ConsentData = {
    source: consentState.source ?? ConsentSource.Unknown,
    ad_Storage: consentState.ad_Storage === Constant.Granted ? BooleanFlag.True : BooleanFlag.False,
    analytics_Storage: consentState.analytics_Storage === Constant.Granted ? BooleanFlag.True : BooleanFlag.False,
  };

  return consent;
}

function normalizeConsent(value: unknown, fallback: string = Constant.Denied): string {
  return typeof value === 'string' ? value.toLowerCase() : fallback;
}

export function clear(all: boolean = false): void {
  // Clear any stored information in the cookie that tracks session information so we can restart fresh the next time
  setCookie(Constant.SessionKey, Constant.Empty, 0);

  // Clear user cookie as well if all flag is set
  if (all) {
    setCookie(Constant.CookieKey, Constant.Empty, 0);
  }
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

export function callback(consentUpdate: boolean = false): void {
  let upgrade = config.lean ? BooleanFlag.False : BooleanFlag.True;
  processCallback(upgrade, consentUpdate);
}

export function save(): void {
  if (!data || !config.track) return;
  let ts = Math.round(Date.now());
  let upload = config.upload && typeof config.upload === Constant.String ? (config.upload as string).replace(Constant.HTTPS, Constant.Empty) : Constant.Empty;
  let upgrade = config.lean ? BooleanFlag.False : BooleanFlag.True;
  setCookie(Constant.SessionKey, [data.sessionId, ts, data.pageNum, upgrade, upload].join(COOKIE_SEP), Setting.SessionExpire);
}

function processCallback(upgrade: BooleanFlag, consentUpdate: boolean = false): void {
  if (callbacks.length > 0) {
    for (let i = 0; i < callbacks.length; i++) {
      const cb = callbacks[i];
      if (
        cb.callback &&
        ((!cb.called && !consentUpdate) || (cb.consentInfo && consentUpdate)) && //If consentUpdate is true, we only call the callback if it has consentInfo
        (!cb.wait || upgrade)
      ) {
        cb.callback(data, !config.lean, cb.consentInfo ? consentStatus : undefined);
        cb.called = true;
        if (!cb.recall) {
          callbacks.splice(i, 1);
          i--;
        }
      }
    }
  }
}

function track(u: User, consent: BooleanFlag = null): void {
  // If consent is not explicitly specified, infer it from the user object
  consent = consent === null ? u.consent : consent;
  // Convert time precision into days to reduce number of bytes we have to write in a cookie
  // E.g. Math.ceil(1628735962643 / (24*60*60*1000)) => 18852 (days) => ejo in base36 (13 bytes => 3 bytes)
  let end = Math.ceil((Date.now() + (Setting.Expire * Time.Day)) / Time.Day);
  // If DOB is not set in the user object, use the date set in the config as a DOB
  let dob = u.dob === 0 ? (config.dob === null ? 0 : config.dob) : u.dob;

  // To avoid cookie churn, write user id cookie only once every day
  if (u.expiry === null || Math.abs(end - u.expiry) >= Setting.CookieInterval || u.consent !== consent || u.dob !== dob) {
    let cookieParts = [data.userId, Setting.CookieVersion, end.toString(36), consent, dob];
    setCookie(Constant.CookieKey, cookieParts.join(COOKIE_SEP), Setting.Expire);
  }
}

export function shortid(): string {
  let id = Math.floor(Math.random() * Math.pow(2, 32));
  if (window && window.crypto && window.crypto.getRandomValues && Uint32Array) {
    id = window.crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return id.toString(36);
}

function session(): Session {
  let output: Session = { session: shortid(), ts: Math.round(Date.now()), count: 1, upgrade: null, upload: Constant.Empty };
  let value = getCookie(Constant.SessionKey, !config.includeSubdomains);
  if (value) {
    // Maintaining support for pipe separator for backward compatibility, this can be removed in future releases
    let parts = value.includes(Constant.Caret) ? value.split(Constant.Caret) : value.split(Constant.Pipe);
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
  let output: User = { id: shortid(), version: 0, expiry: null, consent: BooleanFlag.False, dob: 0 };
  let cookie = getCookie(Constant.CookieKey, !config.includeSubdomains);
  if (cookie && cookie.length > 0) {
    // Splitting and looking up first part for forward compatibility, in case we wish to store additional information in a cookie
    // Maintaining support for pipe separator for backward compatibility, this can be removed in future releases
    let parts = cookie.includes(Constant.Caret) ? cookie.split(Constant.Caret) : cookie.split(Constant.Pipe);
    // Read version information and timestamp from cookie, if available
    if (parts.length > 1) { output.version = num(parts[1]); }
    if (parts.length > 2) { output.expiry = num(parts[2], 36); }
    // Check if we have explicit consent to track this user
    if (parts.length > 3 && num(parts[3]) === 1) { output.consent = BooleanFlag.True; }
    if (parts.length > 4 && num(parts[1]) > 1) { output.dob = num(parts[4]); }
    // Set track configuration to true for this user if we have explicit consent, regardless of project setting
    config.track = config.track || output.consent === BooleanFlag.True;
    // Get user id from cookie only if we tracking is enabled, otherwise fallback to a random id
    output.id = config.track ? parts[0] : output.id;
  }
  return output;
}

