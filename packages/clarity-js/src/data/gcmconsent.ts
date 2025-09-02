import { ConsentSource, ConsentState, Constant, gcmConsentState } from "@clarity-types/data";
import { GCMConsent } from "@clarity-types/data";
import { consentv2 } from "./metadata";

export let consentState: ConsentState = {};

export function start() {
    if (window.google_tag_data?.ics?.addListener) {
        window.google_tag_data.ics.addListener(
            [Constant.AdStorage, Constant.AnalyticsStorage],
            gcmConsent
        );
    }
}

export function stop() {
    consentState = {};
}

function gcmConsent(): void {
    const ics = window.google_tag_data?.ics;
    if (!ics?.getConsentState) {
        return;
    }

    const analytics_storage = ics.getConsentState("analytics_storage");
    const ad_storage = ics.getConsentState("ad_storage");
    consentState = getConsentState({ ad_Storage: ad_storage, analytics_Storage: analytics_storage });
    consentv2(consentState, ConsentSource.GCM);
}

function getConsentState(googleConsent: gcmConsentState): ConsentState {
    const consentState: ConsentState = {
        ad_Storage: googleConsent.ad_Storage === GCMConsent.Granted ? Constant.Granted : Constant.Denied,
        analytics_Storage: googleConsent.analytics_Storage === GCMConsent.Granted ? Constant.Granted : Constant.Denied,
    };

    return consentState;
}