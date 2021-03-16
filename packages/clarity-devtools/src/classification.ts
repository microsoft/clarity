import { Core } from "clarity-js";

export default function(): Core.Config {
    return {
        regions: {
            "header": "header",
            "footer": "footer"
        },
        metrics: {
            ".order-total": 20
        }
    };
}
