import * as clarity from "@src/clarity";

// Expose clarity variable globally to allow access to public interface in a browser
// tslint:disable-next-line:no-typeof-undefined
if (typeof window !== "undefined") {
    (window as any).clarity = clarity;
}
