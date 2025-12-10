import { Constant } from "@clarity-types/data";
import config from "@src/core/config";
import { decodeCookieValue, encodeCookieValue, supported } from "@src/data/util";

let rootDomain = null;
export const COOKIE_SEP = Constant.Caret;

export function start() {
  rootDomain = null;
}

export function stop() {
  rootDomain = null;
}

export function getCookie(key: string, limit = false): string {
  if (supported(document, Constant.Cookie)) {
    let cookies: string[] = document.cookie.split(Constant.Semicolon);
    if (cookies) {
      for (let i = 0; i < cookies.length; i++) {
        let pair: string[] = cookies[i].split(Constant.Equals);
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

export function setCookie(key: string, value: string, time: number): void {
  // only write cookies if we are currently in a cookie writing mode (and they are supported)
  // OR if we are trying to write an empty cookie (i.e. clear the cookie value out)
  if ((config.track || value == Constant.Empty) && ((navigator && navigator.cookieEnabled) || supported(document, Constant.Cookie))) {
    // Some browsers automatically url encode cookie values if they are not url encoded.
    // We therefore encode and decode cookie values ourselves.
    let encodedValue = encodeCookieValue(value);

    let expiry = new Date();
    expiry.setDate(expiry.getDate() + time);
    let expires = expiry ? Constant.Expires + expiry.toUTCString() : Constant.Empty;
    let cookie = `${key}=${encodedValue}${Constant.Semicolon}${expires}${Constant.Path}`;
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
