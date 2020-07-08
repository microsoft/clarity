import * as decode from "@src/clarity";

// Expose clarity variable globally to allow access to public interface in a browser
// tslint:disable-next-line:no-typeof-undefined
if (typeof window !== "undefined") {
    if ((window as any).clarity === undefined || (window as any).clarity === null) {
        (window as any).clarity = {};
    }
    (window as any).clarity.decode = decode;
}
