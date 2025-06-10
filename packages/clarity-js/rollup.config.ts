import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import pkg from "./package.json" assert { type: "json" };
import path from "path";
const target = process.env.TARGET || "es2017";
const outDir = process.env.OUTDIR || "build";

export default [
    {
        input: "src/index.ts",
        output: [
            { file: path.join(outDir, path.basename(pkg.main)), format: "cjs", exports: "named" },
            { file: path.join(outDir, path.basename(pkg.module)), format: "es", exports: "named" },
        ],
        plugins: [resolve(), typescript({ target: target }), commonjs({ include: ["node_modules/**"] })],
        onwarn(message, warn) {
            if (message.code === "CIRCULAR_DEPENDENCY") {
                return;
            }
            warn(message);
        },
    },
    {
        input: "src/global.ts",
        output: [{ file: path.join(outDir, path.basename(pkg.unpkg)), format: "iife", exports: "named" }],
        onwarn(message, warn) {
            if (message.code === "CIRCULAR_DEPENDENCY") {
                return;
            }
            warn(message);
        },
        plugins: [, resolve(), typescript({ target: target }), terser({ output: { comments: false } }), commonjs({ include: ["node_modules/**"] })],
    },
    {
        input: "src/global.ts",
        output: [{ file: path.join(outDir, path.basename(pkg.extended)), format: "iife", exports: "named" }],
        onwarn(message, warn) {
            if (message.code === "CIRCULAR_DEPENDENCY") {
                return;
            }
            warn(message);
        },
        plugins: [resolve(), typescript({ target: target }), terser({ output: { comments: false } }), commonjs({ include: ["node_modules/**"] })],
    },
    {
        input: "src/global.ts",
        output: [{ file: path.join(outDir, path.basename(pkg.insight)), format: "iife", exports: "named" }],
        onwarn(message, warn) {
            if (message.code === "CIRCULAR_DEPENDENCY") {
                return;
            }
            warn(message);
        },
        plugins: [
            alias({
                entries: [
                    { find: "@src/layout/style", replacement: "@src/insight/blank" },
                    { find: "@src/layout/document", replacement: "@src/layout/document" },
                    { find: "@src/layout/encode", replacement: "@src/insight/encode" },
                    { find: /@src\/interaction\/(change|clipboard|input|pointer|selection)/, replacement: "@src/insight/blank" },
                    { find: /@src\/layout.*/, replacement: "@src/insight/snapshot" },
                    { find: /@src\/performance.*/, replacement: "@src/insight/blank" },
                ],
            }),
            resolve(),
            typescript({ target: target }),
            terser({ output: { comments: false } }),
            commonjs({ include: ["node_modules/**"] }),
        ],
    },
    {
        input: "src/global.ts",
        output: [{ file: path.join(outDir, path.basename(pkg.performance)), format: "iife", exports: "named" }],
        onwarn(message, warn) {
            if (message.code === "CIRCULAR_DEPENDENCY") {
                return;
            }
            warn(message);
        },
        plugins: [
            alias({
                entries: [
                    { find: /@src\/interaction.*/, replacement: "@src/performance/blank" },
                    { find: /@src\/layout.*/, replacement: "@src/performance/blank" },
                    { find: /@src\/diagnostic.*/, replacement: "@src/performance/blank" },
                    { find: /@src\/data\/(extract|baseline|summary)/, replacement: "@src/performance/blank" },
                ],
            }),
            resolve(),
            typescript({ target: target }),
            terser({ output: { comments: false } }),
            commonjs({ include: ["node_modules/**"] }),
        ],
    },
];
