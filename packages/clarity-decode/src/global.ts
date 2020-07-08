import * as decode from "@src/clarity";

// Expose clarity variable globally to allow access to public interface in a browser
if (window) {
    if ((window as any).clarity === undefined || (window as any).clarity === null) {
        (window as any).clarity = {};
    }
    (window as any).clarity.decode = decode;
}
