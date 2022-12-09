import { Data, Layout } from "clarity-js";

export function expand(input: string): [string, string] {
    let parts = input.split(Data.Constant.Dot);
    let value: string = Layout.Constant.Empty;
    for (let i = 0; i < parseInt(parts[0], 36); i++) {
        value += i > 0 && i % Data.Setting.WordLength === 0 ? Data.Constant.Space : Data.Constant.Mask;
    }
    return [value, parts[1]];
}