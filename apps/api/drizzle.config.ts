import { defineConfig } from 'drizzle-kit'

try {
  process.loadEnvFile()
} catch {
  /* sin .env */
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
})
