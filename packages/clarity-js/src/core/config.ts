import { Config, Time } from "@clarity-types/core";

let config: Config = {
    projectId: null,
    delay: 1 * Time.Second,
    cssRules: false,
    lean: false,
    track: true,
    content: true,
    mask: [],
    unmask: [],
    regions: [],
    metrics: [],
    cookies: [],
    server: null,
    report: null,
    upload: null,
    upgrade: null
};

export default config;
