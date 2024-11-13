import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { extractRuntimeProps } from 'vue/compiler-sfc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      {find: 'lvv', replacement: path.resolve(__dirname, './src/modules/clarity-js/src/')},
      {find: 'lds', replacement: path.resolve(__dirname, './src')},
      {find: "@src", replacement: path.resolve(__dirname, '../clarity-js/src/')},
      {find: "@clarity-types", replacement: path.resolve(__dirname, '../clarity-js/types/')}
    ],
    extensions: ['.ts', '.js', '.d.ts']
  }
})
