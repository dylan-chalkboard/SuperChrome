import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        background: 'src/background.ts',
        palette: 'src/palette.ts',
        popup: 'popup.html',
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
})
