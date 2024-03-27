import { Config, Time } from "@clarity-types/core";

let config: Config = {
    projectId: null,
    delay: 1 * Time.Second,
    lean: false,
    track: true,
    content: true,
    drop: [],
    mask: [],
    unmask: [],
    regions: [],
    cookies: [],
    fraud: true,
    checksum: [],
    report: null,
    upload: null,
    fallback: null,
    upgrade: null,
    action: null,
    dob: null,
    delayDom: false
};

export default config;
