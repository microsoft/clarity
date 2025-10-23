import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
export default [
  {
    input: "src/index.ts",
    output: [
      { file: pkg.main, format: "cjs", exports: "named" },
      { file: pkg.module, format: "es", exports: "named" }
    ],
    plugins: [
      resolve(),
      typescript(),
      commonjs({ include: ["node_modules/**"] })
    ],
    onwarn(message, warn) {
      if (message.code === 'CIRCULAR_DEPENDENCY') { return; }
      warn(message);
    }
  },
  {
    input: "src/global.ts",
    output: [ { file: pkg.unpkg, format: "iife", exports: "named" } ],
    onwarn(message, warn) {
      if (message.code === 'CIRCULAR_DEPENDENCY') { return; }
      warn(message);
    },
    plugins: [
      resolve(),
      typescript(),
      terser({output: {comments: false}}),
      commonjs({ include: ["node_modules/**"] })
    ]
  },
  {
    input: "src/global.ts",
    output: [ { file: pkg.extended, format: "iife", exports: "named" } ],
    onwarn(message, warn) {
      if (message.code === 'CIRCULAR_DEPENDENCY') { return; }
      warn(message);
    },
    plugins: [
      resolve(),
      typescript(),
      terser({output: {comments: false}}),
      commonjs({ include: ["node_modules/**"] })
    ]
  },
  {
    input: "src/global.ts",
    output: [ { file: pkg.insight, format: "iife", exports: "named" } ],
    onwarn(message, warn) {
      if (message.code === 'CIRCULAR_DEPENDENCY') { return; }
      warn(message);
    },
    plugins: [
      alias({
        entries: [
          { find: '@src/layout/style', replacement: '@src/insight/blank' },
          { find: '@src/layout/document', replacement: '@src/layout/document' },
          { find: '@src/layout/encode', replacement: '@src/insight/encode' },
          { find: /@src\/interaction\/(change|clipboard|input|pointer|selection)/, replacement: '@src/insight/blank' },
          { find: /@src\/layout.*/, replacement: '@src/insight/snapshot' },
          { find: /@src\/performance.*/, replacement: '@src/insight/blank' }
        ]
      }),
      resolve(),
      typescript(),
      terser({output: {comments: false}}),
      commonjs({ include: ["node_modules/**"] })
    ]
  },
  {
    input: "src/global.ts",
    output: [ { file: pkg.performance, format: "iife", exports: "named" } ],
    onwarn(message, warn) {
      if (message.code === 'CIRCULAR_DEPENDENCY') { return; }
      warn(message);
    },
    plugins: [
      alias({
        entries: [
          { find: /@src\/interaction.*/, replacement: '@src/performance/blank' },
          { find: /@src\/layout.*/, replacement: '@src/performance/blank' },
          { find: /@src\/diagnostic.*/, replacement: '@src/performance/blank' },
          { find: /@src\/data\/(extract|baseline|summary)/, replacement: '@src/performance/blank' },
          { find: /@src\/core\/dynamic/, replacement: '@src/performance/blank' }
        ]
      }),
      resolve(),
      typescript(),
      terser({output: {comments: false}}),
      commonjs({ include: ["node_modules/**"] })
    ]
  },
  {
    input: "src/dynamic/agent/index.ts",
    output: [ { file: pkg.livechat, format: "iife", exports: "named" } ],
    onwarn(message, warn) {
      if (message.code === 'CIRCULAR_DEPENDENCY') { return; }
      warn(message);
    },
    plugins: [
      alias({
        entries: [
          { find: /@src\/dynamic\/agent\/tidio.*/, replacement: '@src/dynamic/agent/blank' },
          { find: /@src\/dynamic\/agent\/crisp.*/, replacement: '@src/dynamic/agent/blank' }
        ]
      }),
      resolve(),
      typescript(),
      terser({output: {comments: false}}),
      commonjs({ include: ["node_modules/**"] })
    ]
  },
  {
    input: "src/dynamic/agent/index.ts",
    output: [ { file: pkg.tidio, format: "iife", exports: "named" } ],
    onwarn(message, warn) {
      if (message.code === 'CIRCULAR_DEPENDENCY') { return; }
      warn(message);
    },
    plugins: [
      alias({
        entries: [
          { find: /@src\/dynamic\/agent\/livechat.*/, replacement: '@src/dynamic/agent/blank' },
          { find: /@src\/dynamic\/agent\/crisp.*/, replacement: '@src/dynamic/agent/blank' }
        ]
      }),
      resolve(),
      typescript(),
      terser({output: {comments: false}}),
      commonjs({ include: ["node_modules/**"] })
    ]
  },
  {
    input: "src/dynamic/agent/index.ts",
    output: [ { file: pkg.crisp, format: "iife", exports: "named" } ],
    onwarn(message, warn) {
      if (message.code === 'CIRCULAR_DEPENDENCY') { return; }
      warn(message);
    },
    plugins: [
      alias({
        entries: [
          { find: /@src\/dynamic\/agent\/livechat.*/, replacement: '@src/dynamic/agent/blank' },
          { find: /@src\/dynamic\/agent\/tidio.*/, replacement: '@src/dynamic/agent/blank' }
        ]
      }),
      resolve(),
      typescript(),
      terser({output: {comments: false}}),
      commonjs({ include: ["node_modules/**"] })
    ]
  }
];
