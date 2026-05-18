import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './public/manifest.json'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

function stableJsFileName(chunkInfo) {
  const moduleId = chunkInfo.facadeModuleId || ''

  if (moduleId.includes('/src/content/')) {
    return 'assets/content.js'
  }

  if (moduleId.includes('/src/background/')) {
    return 'assets/background.js'
  }

  const name = chunkInfo.name.endsWith('.js')
    ? chunkInfo.name.slice(0, -3)
    : chunkInfo.name

  return `assets/${name}.js`
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        popup: resolve(__dirname, 'popup.html'),
      },
      output: {
        entryFileNames: stableJsFileName,
        chunkFileNames: stableJsFileName,
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    crx({ manifest }),
  ],
})
