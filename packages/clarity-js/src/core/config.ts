import { Config, Time } from "@clarity-types/core";

let config: Config = {
    projectId: null,
    delay: 3 * Time.Second,
    cssRules: false,
    lean: true,
    track: true,
    mask: true,
    suppress: [],
    regions: {},
    cookies: [],
    url: "",
    upload: null
};

export default config;
