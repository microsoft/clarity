import { Dimension } from "@clarity-types/data";
import * as dimension from "@src/data/dimension";

const enum ConsentType {
    None = 0,
    Implicit = 1,
    General = 2
}

export function config(track: boolean): void {
    trackConsent(track ? ConsentType.Implicit : ConsentType.None);
}

// When we get consent signal as false, we restart the service and track config as false.
export function consent(): void {
    trackConsent(ConsentType.General);
}

function trackConsent(consent: ConsentType): void {
    dimension.log(Dimension.Consent, consent.toString());
}