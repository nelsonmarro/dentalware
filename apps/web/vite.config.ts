import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { INCLUDE_ASSETS, manifest } from './src/pwa-manifest.ts'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }), // antes de react()
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: INCLUDE_ASSETS,
      manifest,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
  },
})
