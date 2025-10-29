import { ConsentData, ConsentSource, ConsentState, ConsentType, Constant, Dimension, Event, GCMConsent, GCMConsentState } from "@clarity-types/data";
import * as dimension from "@src/data/dimension";
import encode from "./encode";
import { consentv2 } from "./metadata";

export let data: ConsentData = null;
let updateConsent: boolean = true;

export function start(): void {
    const ics = window.google_tag_data?.ics;
    updateConsent = true;
    if (ics?.addListener) {
        ics.addListener(
            [Constant.AdStorage, Constant.AnalyticsStorage],
            processConsent
        );
    }
}

export function stop(): void {
    updateConsent = true;
}

function processConsent(): void {
    const ics = window.google_tag_data?.ics;
    if (!ics?.getConsentState) {
        return;
    }

    const analytics_storage = ics.getConsentState(Constant.AnalyticsStorage);
    const ad_storage = ics.getConsentState(Constant.AdStorage);
    const consentState = getConsentState({ ad_Storage: ad_storage, analytics_Storage: analytics_storage });
    consentv2(consentState, ConsentSource.GCM);
}

function getConsentState(googleConsent: GCMConsentState): ConsentState {
    const consentState: ConsentState = {
        ad_Storage: googleConsent.ad_Storage === GCMConsent.Granted ? Constant.Granted : Constant.Denied,
        analytics_Storage: googleConsent.analytics_Storage === GCMConsent.Granted ? Constant.Granted : Constant.Denied,
    };

    return consentState;
}


export function config(consent: ConsentData): void {
    trackConsent(consent.analytics_Storage ? ConsentType.Implicit : ConsentType.None);
    data = consent;
}

// When we get consent signal as false, we restart the service and track config as false.
export function consent(): void {
    trackConsent(ConsentType.General);
}

function trackConsent(consent: ConsentType): void {
    dimension.log(Dimension.Consent, consent.toString());
}

export function trackConsentv2(consent: ConsentData): void {
    data = consent;
    encode(Event.Consent);
}

// Compute function is called every upload, but we only want to send consent data once.
export function compute(): void {
    if (updateConsent) {
        encode(Event.Consent);
        updateConsent = false;
        const ics = window.google_tag_data?.ics;
        if(ics?.usedUpdate){
            processConsent();
        }
    }
}