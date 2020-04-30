import typescript from "rollup-plugin-typescript2";
import commonjs from "rollup-plugin-commonjs";
import resolve from "rollup-plugin-node-resolve";
import { terser } from "rollup-plugin-terser";
import pkg from "./package.json";

export default [
  {
    input: "src/index.ts",
    output: [
      { file: pkg.main, format: "cjs", exports: "named" },
      { file: pkg.module, format: "es", exports: "named" }
    ],
    plugins: [
      resolve(),
      typescript({ rollupCommonJSResolveHack: true, clean: true }),
      commonjs({ include: ["node_modules/**"] })
    ]
  },
  {
    input: "src/global.ts",
    output: [ { file: pkg.browser, format: "iife", exports: "named" } ],
    plugins: [
      resolve(),
      typescript({ rollupCommonJSResolveHack: true, clean: true }),
      terser(),
      commonjs({ include: ["node_modules/**"] })
    ]
  }
];
