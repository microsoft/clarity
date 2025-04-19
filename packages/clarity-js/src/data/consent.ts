import { Dimension, Event, Status } from "@clarity-types/data";
import * as dimension from "@src/data/dimension";
import encode from "./encode";

export let data: Status = {};

export function start(): void {
    data = {};
}

export function stop(): void {
    data = {};
}

const enum ConsentType {
    None = 0,
    Implicit = 1,
    General = 2
}

export function config(track: boolean): void {
    const status: Status = {
        adStorage: track,
        analyticsStorage: track
    };
    trackConsent(track ? ConsentType.Implicit : ConsentType.None);
    consentv2(status);
}

// When we get consent signal as false, we restart the service and track config as false.
export function consent(): void {
    trackConsent(ConsentType.General);
}

function trackConsent(consent: ConsentType): void {
    dimension.log(Dimension.Consent, consent.toString());
}

export function consentv2(status: Status): void {
    data = status;
    encode(Event.Consent);
}

export function reset(): void {
    data = {};
}