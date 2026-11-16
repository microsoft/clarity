import { expect, test } from "@playwright/test";
import { decode } from "clarity-decode";

test("decodes WebMCP actions", () => {
    const result = decode(JSON.stringify({
        e: ["0.8.77", 1, 0, 100, "devtools", "user", "session", 1, 0, 0, 0, "https://test.com/"],
        a: [[70, 54, 1, 1], [80, 54, 2, "custom_tool"], [90, 54, 3]],
    }));

    expect(result.webMcp).toEqual([
        { time: 70, event: 54, data: { action: 1, name: 1 } },
        { time: 80, event: 54, data: { action: 2, name: "custom_tool" } },
        { time: 90, event: 54, data: { action: 3, name: null } },
    ]);
});
