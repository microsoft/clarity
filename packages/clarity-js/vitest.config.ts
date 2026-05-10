import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        include: ["test/**/*.unit.ts"],
    },
    resolve: {
        alias: [
            { find: /^@src\/(.*)/, replacement: path.resolve(__dirname, "src/$1") },
            { find: /^@clarity-types\/(.*)/, replacement: path.resolve(__dirname, "test/generated-types/$1") },
        ],
    },
});
