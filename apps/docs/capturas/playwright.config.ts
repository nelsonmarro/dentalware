import { defineConfig, devices } from '@playwright/test'

/** Capturas del manual (Iteración 8). No son tests: cada «test» recorre una pantalla con los
 * datos de demostración y guarda capturas con nombre fijo. Corre con `pnpm capturas` (modo
 * completo: contraseña nueva, reseed, API propia con reloj fijo) o con `CAPTURAS_RAPIDO=1`
 * (reutiliza la API de `capturas:servidores`, la BD y las sesiones). */
if (!process.env.DEMO_PASSWORD) {
  throw new Error('Corre las capturas con `pnpm capturas` (lee o genera DEMO_PASSWORD).')
}
const rapido = process.env.CAPTURAS_RAPIDO === '1'
/** El mismo instante que `DEMO_NOW` de apps/api/src/scripts/seed-demo-data.ts. */
export const CLOCK_FIXED_AT = '2026-10-20T10:30:00-05:00'

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  globalSetup: './global-setup.ts',
  outputDir: '../test-results',
  use: { baseURL: 'http://localhost:5173', locale: 'es-EC', timezoneId: 'America/Guayaquil' },
  webServer: [
    {
      command:
        'pnpm --filter @dentalware/shared build && pnpm --filter @dentalware/api reset-test-db && pnpm --filter @dentalware/api seed && pnpm --filter @dentalware/api seed:demo && pnpm --filter @dentalware/api dev',
      url: 'http://localhost:3000/api/health',
      // Completo: siempre con datos frescos. Rápido: la API de `capturas:servidores`.
      reuseExistingServer: rapido,
      timeout: 180_000,
      cwd: '../../..',
      env: { NODE_ENV: 'test', CLOCK_FIXED_AT },
    },
    {
      command: 'pnpm --filter @dentalware/shared build && pnpm --filter @dentalware/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120_000,
      cwd: '../../..',
    },
  ],
  projects: [
    {
      name: 'escritorio',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    { name: 'telefono', use: { ...devices['Pixel 7'] } },
  ],
})
