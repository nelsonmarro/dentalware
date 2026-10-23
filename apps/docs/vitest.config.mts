import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // `@docusaurus/tsconfig` deja `jsx: preserve` (lo transforma el bundler de Docusaurus); en los
  // tests lo transforma Vite con el runtime automático de React.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: { '@docusaurus/Link': fileURLToPath(new URL('./src/test/link.tsx', import.meta.url)) },
  },
  test: {
    name: 'docs',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', '*.test.ts', 'scripts/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
