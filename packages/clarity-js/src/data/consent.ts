import { Dimension, Event } from "@clarity-types/data";
import * as dimension from "@src/data/dimension";
import encode from "./encode";

export let data: string = "";

export function start(): void {
    data = "";
}

export function stop(): void {
    data = "";
}

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

export function consentv2(status: string): void {
    data = status;
}

export function compute(): void {
    encode(Event.Consent);
}

export function reset(): void {
    data = "";
}