import { Constant } from "@clarity-types/core";
import { Code, Severity } from "@clarity-types/data";
import * as internal from "@src/diagnostic/internal";

export default function api(method: string): string {
    // Zone.js, a popular package for Angular, overrides native browser APIs which can lead to inconsistent state for single page applications.
    // Example issue: https://github.com/angular/angular/issues/31712
    // As a work around, we ensuring Clarity access APIs outside of Zone (and use native implementation instead)
    const isZone = window[Constant.Zone] && Constant.Symbol in window[Constant.Zone];
    if (isZone) {
        internal.log(Code.AngularZone, Severity.Info);
        return window[Constant.Zone][Constant.Symbol](method);
    }    
    return method;
}
