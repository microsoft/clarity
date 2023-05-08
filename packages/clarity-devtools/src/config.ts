import { Core } from "clarity-js";

const enum Region {
    Header = 1,
    Footer = 2,
    Navigation = 3
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
    };
}
