import { Dimension } from "@clarity-types/data";
import * as dimension from "@src/data/dimension";

const enum ConsentType {
    None = 0,
    Implicit = 1,
    General = 2,
    TcfSuccess = 3,
    TcfFailure = 3,
}

export function fromTcf(success: boolean, tcfString: string, gdprApplies: boolean): void {
    trackConsent(success ? ConsentType.TcfSuccess : ConsentType.TcfFailure, tcfString, gdprApplies.toString());
}

export function fromConfig(track: boolean): void {
    trackConsent(track ? ConsentType.Implicit : ConsentType.None);
}

// When we get consent signal as false, we restart the service and track config as false.
export function fromConsentApi(): void {
    trackConsent(ConsentType.General);
}

function trackConsent(consent: ConsentType, ...payloads: string[]): void {
    if (payloads && payloads.length > 0) {
        dimension.log(Dimension.Consent, `${consent}:${payloads.join(":")}`);
    }
    else {
        dimension.log(Dimension.Consent, consent.toString());
    }
}