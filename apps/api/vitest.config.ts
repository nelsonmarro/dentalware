import { defineConfig } from 'vitest/config'

// Carga .env.test sin sobrescribir variables ya presentes (CI).
try {
  process.loadEnvFile(new URL('./.env.test', import.meta.url).pathname)
} catch {
  /* sin archivo: se usan las variables del entorno */
}

export default defineConfig({
  test: {
    name: 'api',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    fileParallelism: false, // los tests comparten la BD de test
    testTimeout: 20_000,
  },
})
