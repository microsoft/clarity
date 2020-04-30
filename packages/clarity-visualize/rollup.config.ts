import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";
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
      typescript(),
      commonjs({ include: ["node_modules/**"] })
    ],
    onwarn(message, warn) {
      if (message.code === 'NON_EXISTENT_EXPORT') { return; }
      warn(message);
    }
  },
  {
    input: "src/global.ts",
    output: [ { file: pkg.unpkg, format: "iife", exports: "named" } ],
    plugins: [
      resolve(),
      typescript(),
      terser(),
      commonjs({ include: ["node_modules/**"] })
    ],
    onwarn(message, warn) {
      if (message.code === 'NON_EXISTENT_EXPORT') { return; }
      warn(message);
    }
  }
];
