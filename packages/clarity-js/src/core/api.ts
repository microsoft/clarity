import { Constant } from "@clarity-types/core";

export default function api(method: string): string {
    // Zone.js, a popular package for Angular, overrides native browser APIs which can lead to inconsistent state for single page applications.
    // Example issue: https://github.com/angular/angular/issues/31712
    // As a work around, we ensuring Clarity access APIs outside of Zone (and use native implementation instead)
    return window[Constant.Zone] && Constant.Symbol in window[Constant.Zone] ? window[Constant.Zone][Constant.Symbol](method) : method;
}
