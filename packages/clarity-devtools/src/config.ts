import { Core } from "clarity-js";

const enum Region {
    Header = 1,
    Footer = 2,
    Navigation = 3
}

const extractKey = 1;

export default function(): Core.Config {
    return {
        mask: [],
        unmask: [],
        regions: [
            [Region.Header, "header"],
            [Region.Footer, "footer"], 
            [Region.Navigation, "nav"]
        ],
        extract: [0, extractKey, "performance.timing"] 
    };
}
