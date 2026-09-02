import { defineConfig } from 'vite'

// Second build pass: the palette is a content script, which Chrome loads as a
// classic script — no ESM imports allowed. Bundling it alone as an IIFE lets
// the source import shared modules while the output stays self-contained.
export default defineConfig({
  build: {
    emptyOutDir: false,
    rollupOptions: {
      input: 'src/palette.ts',
      output: {
        format: 'iife',
        entryFileNames: 'palette.js',
        inlineDynamicImports: true,
      },
    },
  },
})
