import * as trackConsent from "@src/data/track-consent";
import * as metadata from "@src/data/metadata";
import config from "@src/core/config";

const v1Api = "__cmp";
const v2Api = "__tcfapi";

let tcfConsentRead = false;
let tcfString: string = null;
let tcfConsent: boolean = null;
let gdprApplies: boolean = null;

export function isSupported(): boolean {
    if (window[v1Api] || window[v2Api]) {
        return true;
    }

    return false;
}

export function readTcfConsent(): void {
    // Only read tcf consent once. If consent was false, we will restart the service, but should not re-read.
    if (tcfConsentRead) {
        return;
    }

    tcfConsentRead = true;

    // Check v2 API first
    if (window[v2Api]) {
        readV2Consent();
    } else if (window[v1Api]) {
        readV1Consent();
    }
}

export function hasCachedConsent(): boolean {
    return tcfConsentRead && tcfConsent !== null && tcfString !== null && gdprApplies !== null;
}

export function getCachedConsent(): [consent: boolean, tcfString: string, gdprApplies: boolean] {
    return [tcfConsent, tcfString, gdprApplies];
}

function readV1Consent() {
    window[v1Api]('getVendorConsents', [1126], function (response, success) {
        if (success) {
            tcfConsent = response['vendorConsents'][1126];
            gdprApplies = response['gdprApplies'];

            // Only invoke metadata consent if there is a change in tracking status.
            if ((config.track && !tcfConsent) || (!config.track && tcfConsent)) {
                metadata.consent(tcfConsent, false);
            }

            if (tcfConsent !== null && tcfString !== null) {
                trackConsent.fromTcf(tcfConsent, tcfString, gdprApplies);
            }
        }
    });

    window[v1Api]('getConsentData', null, function (response, success) {
        if (success) {
            tcfString = response['consentData'];
            gdprApplies = response['gdprApplies'];

            if (tcfConsent !== null && tcfString !== null) {
                trackConsent.fromTcf(tcfConsent, tcfString, gdprApplies);
            }
        }
    });
}

function readV2Consent() {
    window[v2Api]('addEventListener', 2, function (tcData, success) {
        if (success && tcData.eventStatus === 'tcloaded') {
            tcfString = tcData.tcString;
            tcfConsent = tcData.vendor.consents[1126];
            gdprApplies = tcData.gdprApplies;

            // Only invoke metadata consent if there is a change in tracking status.
            if ((config.track && !tcfConsent) || (!config.track && tcfConsent)) {
                metadata.consent(tcfConsent, false);
            }

            trackConsent.fromTcf(tcfConsent, tcfString, gdprApplies);
        }
    });
}