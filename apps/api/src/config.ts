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
  UPLOAD_DIR: z.string().min(1).default('./data/uploads'),
})

export type Config = z.infer<typeof configSchema>

/**
 * Carga `.env.test` cuando `NODE_ENV=test` y `.env` en caso contrario (no sobrescribe
 * variables ya definidas; tolera que el archivo no exista) y valida. Playwright arranca
 * la API con `NODE_ENV=test`, así que los E2E usan la BD de `.env.test`
 * (`dentalware_test`) en vez de escribir sobre la BD de desarrollo.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (env === process.env) {
    const file = env.NODE_ENV === 'test' ? '.env.test' : '.env'
    try {
      process.loadEnvFile(file)
    } catch {
      /* sin archivo: entorno real */
    }
  }
  const parsed = configSchema.safeParse(env)
  if (!parsed.success) {
    const detalle = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Configuración inválida:\n${detalle}`)
  }
  return parsed.data
}
