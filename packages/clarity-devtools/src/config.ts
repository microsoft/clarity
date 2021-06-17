import { Core, Data, Layout } from "clarity-js";

const enum Region {
    Header = 1,
    Footer = 2,
    Navigation = 3
}

export default function(): Core.Config {
    return {
        regions: [
            [Region.Header, "header", 1, Layout.Constant.DevHook], /* 1: Javascript Filter */
            [Region.Footer, "footer", 0, "product"], /* 0: Url */
            [Region.Navigation, "nav"]
        ],
        metrics: [
            [Data.Metric.CartDiscount, 0, "span[data-checkout-discount-amount-target]", 100], /* 0: DOM Text */
            [Data.Metric.ProductPrice, 1, "Analytics.product.price", 100], /* 1: Javascript */
            [Data.Metric.CartTotal, 2, "data-checkout-payment-due-target"], /* 2: DOM Attribute */
        ]
    };
}
