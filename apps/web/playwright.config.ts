import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  webServer: [
    {
      // NODE_ENV=test: desactiva el rate limit fijo de better-auth (3 req/10 s en sign-in) que los 3 proyectos compartirían
      command:
        'NODE_ENV=test pnpm --filter @dentalware/shared build && NODE_ENV=test pnpm --filter @dentalware/api seed && NODE_ENV=test pnpm --filter @dentalware/api dev',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: '../..',
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
