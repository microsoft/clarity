import { Core } from "clarity-js";
import { ExtractSource } from "clarity-js/types/core";

const enum Region {
    Header = 1,
    Footer = 2,
    Navigation = 3
}

const enum Extract {
    Performance = 1
}

export default function(): Core.Config {
    return {
        drop: [],
        mask: [],
        unmask: [],
        regions: [
            [Region.Header, "header"],
            [Region.Footer, "footer"], 
            [Region.Navigation, "nav"]
        ],
        fraud: true,
        checksum: [],
        extract: [ExtractSource.Javascript, Extract.Performance, "performance.timing"] 
    };
}
