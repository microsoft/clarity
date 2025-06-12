import { ConsentData, Dimension, Event } from "@clarity-types/data";
import * as dimension from "@src/data/dimension";
import encode from "./encode";

export let data: ConsentData = null;
let updateConsent: boolean = true;

const enum ConsentType {
    None = 0,
    Implicit = 1,
    General = 2,
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

export function consentv2(consent: ConsentData): void {
    data = consent;
    encode(Event.Consent);
}

// Compute function is called every upload, but we only want to send consent data once.
export function compute(): void {
    if (updateConsent) {
        encode(Event.Consent);
        updateConsent = false;
    }
}