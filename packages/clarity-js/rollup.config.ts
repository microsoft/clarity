import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
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
          { find: '@src/interaction/change', replacement: '@src/core/blank' },
          { find: '@src/interaction/clipboard', replacement: '@src/core/blank' },
          { find: '@src/interaction/input', replacement: '@src/core/blank' },
          { find: '@src/interaction/pointer', replacement: '@src/core/blank' },
          { find: '@src/interaction/selection', replacement: '@src/core/blank' }          
        ]
      }),
      resolve(),
      typescript(),
      terser({output: {comments: false}}),
      commonjs({ include: ["node_modules/**"] })
    ]
  }
];
