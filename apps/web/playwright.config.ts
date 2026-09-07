import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  webServer: [
    {
      command:
        'pnpm --filter @dentalware/shared build && pnpm --filter @dentalware/api reset-test-db && pnpm --filter @dentalware/api seed && pnpm --filter @dentalware/api dev',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: '../..',
      // NODE_ENV=test hace que `loadConfig` (apps/api/src/config.ts) cargue
      // `apps/api/.env.test` (BD `dentalware_test`, PORT 3000, mismo admin que
      // `.env.example`/`e2e/helpers.ts`) en vez de `.env` (BD de desarrollo), y
      // desactiva el rate limit fijo de better-auth (3 req/10 s en sign-in) que los 3
      // proyectos compartirían. `reset-test-db` vacía la BD de test antes del seed: los
      // tests unitarios (`pnpm test`) usan la misma BD y pueden dejar filas sin truncar
      // (p. ej. `cases`/`case_sequences`) que chocarían con los trabajos que crean los E2E.
      env: { NODE_ENV: 'test' },
    },
    {
      command: 'pnpm --filter @dentalware/shared build && pnpm --filter @dentalware/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: '../..',
    },
  ],
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
  ],
})
