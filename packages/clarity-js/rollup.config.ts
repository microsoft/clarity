import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import pkg from "./package.json" assert { type: 'json' };

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
          { find: '@src/layout/document', replacement: '@src/layout/document' },
          { find: '@src/layout/encode', replacement: '@src/insight/encode' },
          { find: /@src\/interaction\/(change|clipboard|input|pointer|selection)/, replacement: '@src/insight/blank' },
          { find: /@src\/layout.*/, replacement: '@src/insight/snapshot' },
          { find: /@src\/performance.*/, replacement: '@src/insight/blank' }
        ]
      }),
      resolve(),
      typescript(),
      commonjs({ include: ["node_modules/**"] })
    ]
  }
];
