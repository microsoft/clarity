import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import css from "rollup-plugin-import-css";
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
      css({ include: ["**/*.css"], alwaysOutput:true, minify:true,  modules:true }),
      typescript(),
      commonjs({ include: ["node_modules/**"] })
    ],
    onwarn(message, warn) {
      if (message.code === 'NON_EXISTENT_EXPORT') { return; }
      if (message.code === 'CIRCULAR_DEPENDENCY') { return; }
      if (message.code === 'SOURCEMAP_ERROR') { return; }
      warn(message);
    }
  },
  {
    input: "src/global.ts",
    output: [ { file: pkg.unpkg, format: "iife", exports: "named" } ],
    plugins: [
      resolve(),      
      css({ include: ["**/*.css"], alwaysOutput:true, minify:true,  modules:true }),
      typescript(),
      terser({output: {comments: false}}),
      commonjs({ include: ["node_modules/**"] })
    ],
    onwarn(message, warn) {
      if (message.code === 'NON_EXISTENT_EXPORT') { return; }
      if (message.code === 'CIRCULAR_DEPENDENCY') { return; }
      if (message.code === 'SOURCEMAP_ERROR') { return; }
      warn(message);
    }
  }
];
