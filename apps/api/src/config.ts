import { z } from 'zod'

const configSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'], {
      error: 'NODE_ENV debe ser development, test o production',
    })
    .default('development'),
  PORT: z.coerce
    .number({ error: 'PORT debe ser un entero positivo' })
    .int({ error: 'PORT debe ser un entero positivo' })
    .positive({ error: 'PORT debe ser un entero positivo' })
    .default(3000),
  DATABASE_URL: z.url({ error: 'DATABASE_URL debe ser una URL postgres://' }),
  BETTER_AUTH_SECRET: z
    .string({ error: 'BETTER_AUTH_SECRET: mínimo 32 caracteres' })
    .min(32, { error: 'BETTER_AUTH_SECRET: mínimo 32 caracteres' }),
  BETTER_AUTH_URL: z.url({ error: 'BETTER_AUTH_URL debe ser una URL válida' }),
  WEB_ORIGIN: z.url({ error: 'WEB_ORIGIN debe ser una URL válida' }),
  ADMIN_EMAIL: z.email({ error: 'ADMIN_EMAIL debe ser un correo válido' }),
  ADMIN_PASSWORD: z
    .string({ error: 'ADMIN_PASSWORD: mínimo 8 caracteres' })
    .min(8, { error: 'ADMIN_PASSWORD: mínimo 8 caracteres' }),
  ADMIN_NAME: z
    .string()
    .min(1, { error: 'ADMIN_NAME no puede estar vacío' })
    .default('Administrador'),
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
