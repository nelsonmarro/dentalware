import { defineConfig, devices } from '@playwright/test'

/** Barrido del manual construido (revisión UI/UX de la It8, #137): objetivos táctiles, scroll
 * horizontal, consola, rótulos en español y landmarks, a 1280, 390 y 360. No necesita la API ni
 * datos: `docusaurus serve --build` construye el sitio y lo sirve en 3100. En local, con el sitio
 * ya servido (`pnpm --filter @dentalware/docs serve`), lo reutiliza. */
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  outputDir: '../test-results/sitio',
  use: { baseURL: 'http://localhost:3100', locale: 'es-EC' },
  webServer: {
    command: 'pnpm exec docusaurus serve --build --port 3100 --no-open',
    url: 'http://localhost:3100/',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    cwd: '..',
  },
  projects: [
    {
      name: 'escritorio',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    // Un teléfono con Chromium (el de las capturas, a 390): WebKit no corre en local fuera de
    // Ubuntu (#133) y el barrido mide CSS, no el motor.
    { name: 'telefono', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'telefono-360', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } } },
    // Safari solo en CI: WebKit no arranca en local fuera de Ubuntu (Arch no trae sus librerías,
    // #133); el job `e2e` ya instala WebKit para los E2E de la web.
    ...(process.env.CI
      ? [
          {
            name: 'telefono-webkit',
            use: {
              ...devices['iPhone 13'],
              viewport: { width: 390, height: 844 },
              browserName: 'webkit' as const,
            },
          },
        ]
      : []),
  ],
})
