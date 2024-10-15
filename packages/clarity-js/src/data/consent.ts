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

export function consent(consent: boolean): void {
    trackConsent(consent ? ConsentType.General : ConsentType.None);
}

function trackConsent(consent: ConsentType): void {
    dimension.log(Dimension.Consent, consent.toString());
}