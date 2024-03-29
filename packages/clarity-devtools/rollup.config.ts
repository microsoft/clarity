import resolve from "@rollup/plugin-node-resolve";
import copy from "rollup-plugin-copy";
import typescript from "@rollup/plugin-typescript";

export default [
  {
    input: "src/devtools.ts",
    output: [{ file: "extension/devtools.js", format: "iife", exports: "named" }],
    plugins: [
      resolve(),
      typescript(),
      copy({ targets: [{ src: "static/*", dest: "extension/" }] })
    ]
  },
  {
    input: "src/background.ts",
    output: [{ file: "extension/background.js", format: "iife", exports: "named" }],
    plugins: [resolve(), typescript()]
  },
  {
    input: "src/content.ts",
    output: [{ file: "extension/content.js", format: "iife", exports: "named" }],
    plugins: [resolve(), typescript()]
  },
  {
    input: "src/clarity.ts",
    output: [{ file: "extension/clarity.js", format: "iife", exports: "named" }],
    plugins: [resolve(), typescript()]
  },
  {
    input: "src/popup.ts",
    output: [{ file: "extension/popup.js", format: "iife", exports: "named" }],
    plugins: [resolve(), typescript()]
  },
  {
    input: "src/panel.ts",
    output: [{ file: "extension/panel.js", format: "iife", exports: "named" }],
    plugins: [resolve(), typescript()]
  }
];
