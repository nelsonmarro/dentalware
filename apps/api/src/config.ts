import { z } from 'zod'

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url({ error: 'DATABASE_URL debe ser una URL postgres://' }),
  BETTER_AUTH_SECRET: z.string().min(32, { error: 'BETTER_AUTH_SECRET: mínimo 32 caracteres' }),
  BETTER_AUTH_URL: z.url(),
  WEB_ORIGIN: z.url(),
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: z.string().min(8),
  ADMIN_NAME: z.string().min(1).default('Administrador'),
})

export type Config = z.infer<typeof configSchema>

/** Carga `.env` si existe (no sobrescribe variables ya definidas) y valida. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (env === process.env) {
    try {
      process.loadEnvFile()
    } catch {
      /* sin .env: entorno real */
    }
  }
  const parsed = configSchema.safeParse(env)
  if (!parsed.success) {
    const detalle = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Configuración inválida:\n${detalle}`)
  }
  return parsed.data
}
