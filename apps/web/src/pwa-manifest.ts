import type { ManifestOptions } from 'vite-plugin-pwa'

export const INCLUDE_ASSETS = [
  'favicon.ico',
  'apple-touch-icon.png',
  'icon.svg',
  'maskable-icon-512x512.png',
]

export const manifest: Partial<ManifestOptions> = {
  name: 'Dentalware',
  short_name: 'Dentalware',
  description: 'Gestión del laboratorio dental',
  lang: 'es',
  theme_color: '#0f766e',
  background_color: '#F4F6F5',
  display: 'standalone',
  start_url: '/',
  scope: '/',
  id: '/',
  icons: [
    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    {
      src: 'maskable-icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}
