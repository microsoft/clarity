import * as clarity from "@src/clarity";

// Expose clarity variable globally to allow access to public interface in a browser
if (window) {
    (window as any).clarity = clarity;
}
