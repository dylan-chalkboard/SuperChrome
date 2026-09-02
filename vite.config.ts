import { defineConfig } from 'vite'

// The palette content script builds in a second pass (vite.palette.config.ts)
// so it can bundle as a classic-script-safe IIFE while these stay ESM.
export default defineConfig({
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        background: 'src/background.ts',
        popup: 'popup.html',
        options: 'options.html',
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
})
