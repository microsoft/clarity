import { Config, Time } from "@clarity-types/core";

let config: Config = {
    projectId: null,
    delay: 3 * Time.Second,
    cssRules: false,
    lean: true,
    track: true,
    content: true,
    mask: [],
    unmask: [],
    regions: {},
    metrics: {},
    cookies: [],
    report: null,
    upload: null,
    upgrade: null
};

export default config;
