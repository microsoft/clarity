import { Config, Time } from "@clarity-types/core";

let config: Config = {
    projectId: null,
    longtask: 30, // 30 milliseconds
    lookahead: 500, // 500 milliseconds
    distance: 20, // 20 pixels
    interval: 25, // 25 milliseconds
    delay: 3 * Time.Second, // 3 seconds
    expire: 365, // 1 year
    ping: 60 * 1000, // 1 minute
    timeout: 5 * Time.Minute, // 5 minutes
    session: 10 * Time.Minute, // 10 minutes
    shutdown: 2 * Time.Hour, // 2 hours
    cssRules: false,
    lean: false,
    track: true,
    regions: {},
    url: "",
    onstart: null,
    upload: null
};

export default config;
