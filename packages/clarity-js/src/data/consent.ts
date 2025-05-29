import { BooleanFlag, ConsentData, ConsentSource, Dimension, Event } from "@clarity-types/data";
import * as dimension from "@src/data/dimension";
import encode from "./encode";

export let data: ConsentData = null;
let updateConsent: boolean = true;

const enum ConsentType {
    None = 0,
    Implicit = 1,
    General = 2,
}

export function config(track: boolean): void {
    const consent: ConsentData = {
        source: ConsentSource.Implicit,
        ad_Storage: track? BooleanFlag.True : BooleanFlag.False,
        analytics_Storage: track? BooleanFlag.True : BooleanFlag.False,
    };
    trackConsent(track ? ConsentType.Implicit : ConsentType.None);
    consentv2(consent);
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
    updateConsent = true;
}

export function compute(): void {
    if (updateConsent) {
        encode(Event.Consent);
        updateConsent = false;
    }
}