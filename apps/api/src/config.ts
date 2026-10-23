import { z } from 'zod'

const configFields = z.object({
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
  // Almacenamiento de adjuntos (#103): local en el MVP; un driver de la nube (#48) se añade
  // al enum y a `lib/create-storage.ts`. UPLOAD_DIR solo lo usa el driver `local`.
  STORAGE_DRIVER: z
    .enum(['local'], { error: 'STORAGE_DRIVER debe ser «local» (único driver del MVP)' })
    .default('local'),
  UPLOAD_DIR: z.string().min(1).default('./data/uploads'),
  // Reloj fijo de la API (Iteración 8, capturas del manual): un instante ISO con zona. Solo en
  // test: `configSchema` lo rechaza en cualquier otro entorno.
  CLOCK_FIXED_AT: z.iso
    .datetime({
      offset: true,
      error: 'CLOCK_FIXED_AT debe ser una fecha y hora ISO con zona (2026-10-20T10:30:00-05:00)',
    })
    .optional(),
})

const configSchema = configFields.superRefine((v, ctx) => {
  if (v.NODE_ENV !== 'test' && v.CLOCK_FIXED_AT !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['CLOCK_FIXED_AT'],
      message:
        'CLOCK_FIXED_AT solo se admite con NODE_ENV=test (fija el reloj de la API para las capturas del manual)',
    })
  }
})

export type Config = z.infer<typeof configSchema>

/**
 * Clase propia (no `Error` a secas) para que `main.ts` pueda distinguir "la configuración es
 * inválida" (mensaje en español, sin traza) de cualquier otro fallo de arranque (Postgres
 * caído, host inexistente, contraseña incorrecta: esos se imprimen completos, con `cause`,
 * issue #21 ronda de fixes 1).
 */
export class ConfigError extends Error {}

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
    throw new ConfigError(`Configuración inválida:\n${detalle}`)
  }
  return parsed.data
}
