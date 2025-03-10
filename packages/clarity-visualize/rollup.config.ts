import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import { importAsString } from 'rollup-plugin-string-import';
import pkg from "./package.json" assert { type: 'json' };

function wrapWithBackground(svg){
  return `background: url("data:image/svg+xml,${svg}") no-repeat center center;`;
}

function regexEncode(svg){
  svg = svg.replace(/>\s{1,}</g, `><`);
  svg = svg.replace(/\s{2,}/g, ` `);
  return svg.replace(/[\r\n%#()<>?[\\\]^`{|}]/g, encodeURIComponent)
}

function doublesToSingles(svg){
  return svg.replace(/"/g, "'")
}

function preprocessFile(content: string, fileName: string): string {
  if (fileName.endsWith(".css")) {
    // remove comments/newlines
    return content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "").replace(/\r\n/g, "");
  }
  else if (fileName.endsWith(".svg")) {
    // removes comments/newlines while also encoding the svg and adding some scaffolding to import it
    return wrapWithBackground(regexEncode(doublesToSingles(content)));
  }
  return "";
}

export default [
  {
    input: "src/index.ts",
    output: [
      { file: pkg.main, format: "cjs", exports: "named" },
      { file: pkg.module, format: "es", exports: "named" }
    ],
    plugins: [
      resolve(),
      importAsString({ 
        include: ["**/*.css", "**/*.svg"],
        transform: preprocessFile,
      }),
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
      importAsString({ 
        include: ["**/*.css", "**/*.svg"],
        transform: preprocessFile,
      }),
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
