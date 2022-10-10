import { Config, Time } from "@clarity-types/core";

let config: Config = {
    projectId: null,
    delay: 1 * Time.Second,
    lean: false,
    track: true,
    content: true,
    mask: [],
    unmask: [],
    regions: [],
    extract: [],
    cookies: [],
    fraud: [],
    report: null,
    upload: null,
    fallback: null,
    upgrade: null,
    action: null
    signals: false,
};

export default config;
