import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'packages/*/vitest.config.ts',
      'apps/api/vitest.config.ts',
      'apps/web/vitest.config.ts',
      'apps/docs/vitest.config.mts',
    ],
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
})
