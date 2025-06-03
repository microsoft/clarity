import { Time } from "@clarity-types/core";
import {
    BooleanFlag,
    Constant,
    Dimension,
    type Metadata,
    type MetadataCallback,
    type MetadataCallbackOptions,
    Metric,
    type Session,
    Setting,
    type User,
} from "@clarity-types/data";
import * as clarity from "@src/clarity";
import * as core from "@src/core";
import config from "@src/core/config";
import hash from "@src/core/hash";
import * as scrub from "@src/core/scrub";
import * as trackConsent from "@src/data/consent";
import * as dimension from "@src/data/dimension";
import * as metric from "@src/data/metric";
import { set } from "@src/data/variable";

export let data: Metadata = null;
export const callbacks: MetadataCallbackOptions[] = [];
export let electron = BooleanFlag.False;
let rootDomain = null;

export function start(): void {
    rootDomain = null;
    const ua = navigator && "userAgent" in navigator ? navigator.userAgent : Constant.Empty;
    const timezone = Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone ?? "";
    const timezoneOffset = new Date().getTimezoneOffset().toString();
    const ancestorOrigins = window.location.ancestorOrigins ? Array.from(window.location.ancestorOrigins).toString() : "";
    const title = document?.title ? document.title : Constant.Empty;
    electron = ua.indexOf(Constant.Electron) > 0 ? BooleanFlag.True : BooleanFlag.False;

    // Populate ids for this page
    const s = session();
    const u = user();
    const projectId = config.projectId || hash(location.host);
    data = { projectId, userId: u.id, sessionId: s.session, pageNum: s.count };

    // Override configuration based on what's in the session storage, unless it is blank (e.g. using upload callback, like in devtools)
    config.lean = config.track && s.upgrade !== null ? s.upgrade === BooleanFlag.False : config.lean;
    config.upload =
        config.track && typeof config.upload === "string" && s.upload && s.upload.length > Constant.HTTPS.length ? s.upload : config.upload;

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

    // Capture navigator specific dimensions
    if (navigator) {
        dimension.log(Dimension.Language, navigator.language);
        metric.max(Metric.HardwareConcurrency, navigator.hardwareConcurrency);
        metric.max(Metric.MaxTouchPoints, navigator.maxTouchPoints);
        // biome-ignore lint/suspicious/noExplicitAny: not all browsers support navigator.deviceMemory
        metric.max(Metric.DeviceMemory, Math.round((<any>navigator).deviceMemory));
        userAgentData();
    }

    if (screen) {
        metric.max(Metric.ScreenWidth, Math.round(screen.width));
        metric.max(Metric.ScreenHeight, Math.round(screen.height));
        metric.max(Metric.ColorDepth, Math.round(screen.colorDepth));
    }

    // Read cookies specified in configuration
    for (const key of config.cookies) {
        const value = getCookie(key);
        if (value) {
            set(key, value);
        }
    }

    // Track consent config
    trackConsent.config(config.track);

    // Track ids using a cookie if configuration allows it
    track(u);
}

function userAgentData(): void {
    // biome-ignore lint/suspicious/noExplicitAny: not all browsers support navigator.userAgentData
    const uaData = (<any>navigator).userAgentData;
    if (uaData?.getHighEntropyValues) {
        uaData.getHighEntropyValues(["model", "platform", "platformVersion", "uaFullVersion"]).then((ua) => {
            dimension.log(Dimension.Platform, ua.platform);
            dimension.log(Dimension.PlatformVersion, ua.platformVersion);
            if (ua.brands) {
                for (const brand of ua.brands) {
                    dimension.log(Dimension.Brand, brand.name + Constant.Tilde + brand.version);
                }
            }
            dimension.log(Dimension.Model, ua.model);
            metric.max(Metric.Mobile, ua.mobile ? BooleanFlag.True : BooleanFlag.False);
        });
    } else {
        dimension.log(Dimension.Platform, navigator.platform);
    }
}

export function stop(): void {
    rootDomain = null;
    data = null;
    for (const cb of callbacks) {
        cb.called = false;
    }
}

export function metadata(cb: MetadataCallback, wait = true, recall = false): void {
    const upgraded = config.lean ? BooleanFlag.False : BooleanFlag.True;
    let called = false;
    // if caller hasn't specified that they want to skip waiting for upgrade but we've already upgraded, we need to
    // directly execute the callback in addition to adding to our list as we only process callbacks at the moment
    // we go through the upgrading flow.
    if (data && (upgraded || wait === false)) {
        // Immediately invoke the callback if the caller explicitly doesn't want to wait for the upgrade confirmation
        cb(data, !config.lean);
        called = true;
    }
    if (recall || !called) {
        callbacks.push({ callback: cb, wait, recall, called });
    }
}

export function id(): string {
    return data ? [data.userId, data.sessionId, data.pageNum].join(Constant.Dot) : Constant.Empty;
}

export function consent(status = true): void {
    if (!status) {
        config.track = false;
        setCookie(Constant.SessionKey, Constant.Empty, -Number.MAX_VALUE);
        setCookie(Constant.CookieKey, Constant.Empty, -Number.MAX_VALUE);
        clarity.stop();
        window.setTimeout(clarity.start, Setting.RestartDelay);
        return;
    }

    if (core.active()) {
        config.track = true;
        track(user(), BooleanFlag.True);
        save();
        trackConsent.consent();
    }
}

export function clear(): void {
    // Clear any stored information in the cookie that tracks session information so we can restart fresh the next time
    setCookie(Constant.SessionKey, Constant.Empty, 0);
}

function tab(): string {
    let id = shortid();
    if (config.track && supported(window, Constant.SessionStorage)) {
        const value = sessionStorage.getItem(Constant.TabKey);
        id = value ? value : id;
        sessionStorage.setItem(Constant.TabKey, id);
    }
    return id;
}

export function callback(): void {
    const upgrade = config.lean ? BooleanFlag.False : BooleanFlag.True;
    processCallback(upgrade);
}

export function save(): void {
    if (!data || !config.track) return;
    const ts = Math.round(Date.now());
    const upload =
        config.upload && typeof config.upload === "string"
            ? (config.upload as string).replace(Constant.HTTPS, Constant.Empty)
            : Constant.Empty;
    const upgrade = config.lean ? BooleanFlag.False : BooleanFlag.True;
    setCookie(Constant.SessionKey, [data.sessionId, ts, data.pageNum, upgrade, upload].join(Constant.Caret), Setting.SessionExpire);
}

function processCallback(upgrade: BooleanFlag) {
    if (callbacks.length > 0) {
        for (let i = 0; i < callbacks.length; i++) {
            const cb = callbacks[i];
            if (cb.callback && !cb.called && (!cb.wait || upgrade)) {
                cb.callback(data, !config.lean);
                cb.called = true;
                if (!cb.recall) {
                    callbacks.splice(i, 1);
                    i--;
                }
            }
        }
    }
}

function supported(target: Window | Document, api: string): boolean {
    try {
        return !!target[api];
    } catch {
        return false;
    }
}

function track(u: User, consentInput: BooleanFlag = null): void {
    // If consent is not explicitly specified, infer it from the user object
    const consent = consentInput === null ? u.consent : consentInput;
    // Convert time precision into days to reduce number of bytes we have to write in a cookie
    // E.g. Math.ceil(1628735962643 / (24*60*60*1000)) => 18852 (days) => ejo in base36 (13 bytes => 3 bytes)
    const end = Math.ceil((Date.now() + Setting.Expire * Time.Day) / Time.Day);
    // If DOB is not set in the user object, use the date set in the config as a DOB
    const dob = u.dob === 0 ? (config.dob === null ? 0 : config.dob) : u.dob;

    // To avoid cookie churn, write user id cookie only once every day
    if (u.expiry === null || Math.abs(end - u.expiry) >= Setting.CookieInterval || u.consent !== consent || u.dob !== dob) {
        const cookieParts = [data.userId, Setting.CookieVersion, end.toString(36), consent, dob];
        setCookie(Constant.CookieKey, cookieParts.join(Constant.Caret), Setting.Expire);
    }
}

export function shortid(): string {
    let id = Math.floor(Math.random() * 2 ** 32);
    if (window?.crypto?.getRandomValues && Uint32Array) {
        id = window.crypto.getRandomValues(new Uint32Array(1))[0];
    }
    return id.toString(36);
}

function session(): Session {
    const output: Session = { session: shortid(), ts: Math.round(Date.now()), count: 1, upgrade: null, upload: Constant.Empty };
    const value = getCookie(Constant.SessionKey, !config.includeSubdomains);
    if (value) {
        // Maintaining support for pipe separator for backward compatibility, this can be removed in future releases
        const parts = value.includes(Constant.Caret) ? value.split(Constant.Caret) : value.split(Constant.Pipe);
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

function num(string: string, base = 10): number {
    return Number.parseInt(string, base);
}

function user(): User {
    const output: User = { id: shortid(), version: 0, expiry: null, consent: BooleanFlag.False, dob: 0 };
    const cookie = getCookie(Constant.CookieKey, !config.includeSubdomains);
    if (cookie && cookie.length > 0) {
        // Splitting and looking up first part for forward compatibility, in case we wish to store additional information in a cookie
        // Maintaining support for pipe separator for backward compatibility, this can be removed in future releases
        const parts = cookie.includes(Constant.Caret) ? cookie.split(Constant.Caret) : cookie.split(Constant.Pipe);
        // Read version information and timestamp from cookie, if available
        if (parts.length > 1) {
            output.version = num(parts[1]);
        }
        if (parts.length > 2) {
            output.expiry = num(parts[2], 36);
        }
        // Check if we have explicit consent to track this user
        if (parts.length > 3 && num(parts[3]) === 1) {
            output.consent = BooleanFlag.True;
        }
        if (parts.length > 4 && num(parts[1]) > 1) {
            output.dob = num(parts[4]);
        }
        // Set track configuration to true for this user if we have explicit consent, regardless of project setting
        config.track = config.track || output.consent === BooleanFlag.True;
        // Get user id from cookie only if we tracking is enabled, otherwise fallback to a random id
        output.id = config.track ? parts[0] : output.id;
    }
    return output;
}

function getCookie(key: string, limit = false): string {
    if (supported(document, Constant.Cookie)) {
        const cookies: string[] = document.cookie.split(Constant.Semicolon);
        if (cookies) {
            for (let i = 0; i < cookies.length; i++) {
                const pair: string[] = cookies[i].split(Constant.Equals);
                if (pair.length > 1 && pair[0] && pair[0].trim() === key) {
                    // Some browsers automatically url encode cookie values if they are not url encoded.
                    // We therefore encode and decode cookie values ourselves.
                    // For backwards compatability we need to consider 3 cases:
                    // * Cookie was previously not encoded by Clarity and browser did not encode it
                    // * Cookie was previously not encoded by Clarity and browser encoded it once or more
                    // * Cookie was previously encoded by Clarity and browser did not encode it
                    let [isEncoded, decodedValue] = decodeCookieValue(pair[1]);

                    while (isEncoded) {
                        [isEncoded, decodedValue] = decodeCookieValue(decodedValue);
                    }

                    // If we are limiting cookies, check if the cookie value is limited
                    if (limit) {
                        return decodedValue.endsWith(`${Constant.Tilde}1`) ? decodedValue.substring(0, decodedValue.length - 2) : null;
                    }

                    return decodedValue;
                }
            }
        }
    }
    return null;
}

function decodeCookieValue(value: string): [boolean, string] {
    try {
        const decodedValue = decodeURIComponent(value);
        return [decodedValue !== value, decodedValue];
    } catch {}

    return [false, value];
}

function encodeCookieValue(value: string): string {
    return encodeURIComponent(value);
}

function setCookie(key: string, value: string, time: number): void {
    // only write cookies if we are currently in a cookie writing mode (and they are supported)
    // OR if we are trying to write an empty cookie (i.e. clear the cookie value out)
    if ((config.track || value === Constant.Empty) && (navigator?.cookieEnabled || supported(document, Constant.Cookie))) {
        // Some browsers automatically url encode cookie values if they are not url encoded.
        // We therefore encode and decode cookie values ourselves.
        const encodedValue = encodeCookieValue(value);

        const expiry = new Date();
        expiry.setDate(expiry.getDate() + time);
        const expires = expiry ? Constant.Expires + expiry.toUTCString() : Constant.Empty;
        const cookie = `${key}=${encodedValue}${Constant.Semicolon}${expires}${Constant.Path}`;
        try {
            // Attempt to get the root domain only once and fall back to writing cookie on the current domain.
            if (rootDomain === null) {
                const hostname = location.hostname ? location.hostname.split(Constant.Dot) : [];
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
                        if (getCookie(key) === value) {
                            return;
                        }
                    }
                }
                // Finally, if we were not successful and gone through all the options, play it safe and reset rootDomain to be empty
                // This forces our code to fall back to always writing cookie to the current domain
                rootDomain = Constant.Empty;
            }
        } catch {
            rootDomain = Constant.Empty;
        }
        document.cookie = rootDomain ? `${cookie}${Constant.Semicolon}${Constant.Domain}${rootDomain}` : cookie;
    }
}
