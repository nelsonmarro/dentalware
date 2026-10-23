import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // `@docusaurus/tsconfig` deja `jsx: preserve` (lo transforma el bundler de Docusaurus); en los
  // tests lo transforma Vite con el runtime automático de React.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: {
      // Como en Docusaurus: `@site` es la raíz del paquete (lo usa `Captura` para `dimensiones.json`).
      '@site': fileURLToPath(new URL('.', import.meta.url)),
      '@docusaurus/Link': fileURLToPath(new URL('./src/test/link.tsx', import.meta.url)),
      '@docusaurus/Translate': fileURLToPath(new URL('./src/test/translate.tsx', import.meta.url)),
      '@theme/Heading': fileURLToPath(new URL('./src/test/heading.tsx', import.meta.url)),
      '@docusaurus/useBaseUrl': fileURLToPath(
        new URL('./src/test/use-base-url.ts', import.meta.url),
      ),
    },
  },
  test: {
    name: 'docs',
    environment: 'jsdom',
    include: [
      'src/**/*.test.{ts,tsx}',
      '*.test.ts',
      'scripts/**/*.test.ts',
      'capturas/**/*.test.ts',
      'sitio/**/*.test.ts',
    ],
    setupFiles: ['./src/test/setup.ts'],
  },
})
