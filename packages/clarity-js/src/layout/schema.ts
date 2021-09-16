import { Dimension, Metric, Setting } from "@clarity-types/data";
import { Constant, JsonLD } from "@clarity-types/layout";
import * as dimension from "@src/data/dimension";
import * as metric from "@src/data/metric";

const digitsRegex = /[^0-9\.]/g;

/* JSON+LD (Linked Data) Recursive Parser */
export function ld(json: any): void {
    for (let key of Object.keys(json)) {
        let value = json[key];
        if (key === JsonLD.Type && typeof value === "string") {
            value = value.toLowerCase();
            /* Normalizations */
            value = value.indexOf(JsonLD.Article) >= 0 || value.indexOf(JsonLD.Posting) >= 0 ? JsonLD.Article : value;
            switch (value) {
                case JsonLD.Article:
                case JsonLD.Recipe:
                    dimension.log(Dimension.SchemaType, json[key]);
                    dimension.log(Dimension.AuthorName,  json[JsonLD.Creator]);
                    dimension.log(Dimension.Headline,  json[JsonLD.Headline]);
                    break;
                case JsonLD.Product:
                    dimension.log(Dimension.SchemaType, json[key]);
                    dimension.log(Dimension.ProductName, json[JsonLD.Name]);
                    dimension.log(Dimension.ProductSku, json[JsonLD.Sku]);
                    if (json[JsonLD.Brand]) { dimension.log(Dimension.ProductBrand, json[JsonLD.Brand][JsonLD.Name]); }
                    break;
                case JsonLD.AggregateRating:
                    if (json[JsonLD.RatingValue]) {
                        metric.max(Metric.RatingValue, num(json[JsonLD.RatingValue], Setting.RatingScale));
                        metric.max(Metric.BestRating, num(json[JsonLD.BestRating]));
                        metric.max(Metric.WorstRating, num(json[JsonLD.WorstRating]));
                    }
                    metric.max(Metric.RatingCount, num(json[JsonLD.RatingCount]));
                    metric.max(Metric.ReviewCount, num(json[JsonLD.ReviewCount]));
                    break;
                case JsonLD.Author:
                    dimension.log(Dimension.AuthorName, json[JsonLD.Name]);
                    break;
                case JsonLD.Offer:
                    dimension.log(Dimension.ProductAvailability, json[JsonLD.Availability]);
                    dimension.log(Dimension.ProductCondition, json[JsonLD.ItemCondition]);
                    dimension.log(Dimension.ProductCurrency, json[JsonLD.PriceCurrency]);
                    dimension.log(Dimension.ProductSku, json[JsonLD.Sku]);
                    metric.max(Metric.ProductPrice, num(json[JsonLD.Price]));
                    break;
                case JsonLD.Brand:
                    dimension.log(Dimension.ProductBrand, json[JsonLD.Name]);
                    break;
            }
        }
        // Continue parsing nested objects
        if (value !== null && typeof(value) === Constant.Object) { ld(value); }
    }
}

function num(input: string | number, scale: number = 1): number {
    if (input !== null) {
        switch (typeof input) {
            case Constant.Number: return Math.round((input as number) * scale);
            case Constant.String: return Math.round(parseFloat((input as string).replace(digitsRegex, Constant.Empty)) * scale);
        }
    }
    return null;
}
